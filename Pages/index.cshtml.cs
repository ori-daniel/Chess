using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using BCryptNet = BCrypt.Net.BCrypt;

[IgnoreAntiforgeryToken]
public class IndexModel : PageModel {
    public IActionResult OnGetCheckLogin() {
        string token = Request.Cookies["session_token"] ?? "";

        if (token != "") {
            SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
            connection.Open();

            SqliteCommand sessionCommand = connection.CreateCommand();
            sessionCommand.CommandText = "SELECT username, expires_at FROM sessions WHERE token = @token";
            sessionCommand.Parameters.AddWithValue("@token", token);
            SqliteDataReader sessionReader = sessionCommand.ExecuteReader();

            if (sessionReader.Read()) {
                DateTime expiresAt = DateTime.Parse(sessionReader["expires_at"].ToString() ?? "");

                if (expiresAt > DateTime.UtcNow) {
                    string username = sessionReader["username"].ToString() ?? "";

                    SqliteCommand roleCommand = connection.CreateCommand();
                    roleCommand.CommandText = "SELECT role FROM users WHERE username = @username";
                    roleCommand.Parameters.AddWithValue("@username", username);
                    string role = roleCommand.ExecuteScalar()?.ToString() ?? "";

                    SqliteCommand lastLoginCommand = connection.CreateCommand();
                    lastLoginCommand.CommandText = "UPDATE users SET last_login = @last_login WHERE username = @username";
                    lastLoginCommand.Parameters.AddWithValue("@last_login", DateTime.UtcNow.ToString("o"));
                    lastLoginCommand.Parameters.AddWithValue("@username", username);
                    lastLoginCommand.ExecuteNonQuery();

                    connection.Close();
                    return new JsonResult(new { success = "The User Is Logged In", username, role, has_profile_picture = System.IO.File.Exists($"wwwroot/profile-pictures/users/{username}.png") });
                }
            }

            connection.Close();
        }

        return new JsonResult(new { error = "The User Is Not Logged In" }) { StatusCode = 401 };
    }

    public IActionResult OnPostLogout() {
        string token = Request.Cookies["session_token"] ?? "";

        if (token != "") {
            SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
            connection.Open();

            SqliteCommand sessionCommand = connection.CreateCommand();
            sessionCommand.CommandText = "DELETE FROM sessions WHERE token = @token";
            sessionCommand.Parameters.AddWithValue("@token", token);
            sessionCommand.ExecuteNonQuery();

            connection.Close();
        }

        Response.Cookies.Delete("session_token");

        return new JsonResult(new { success = "Logged Out Successfully" });
    }

    public IActionResult OnPostLogin([FromBody] Dictionary<string, string> data) {
        if (!data.ContainsKey("username") || !data.ContainsKey("password")) return new JsonResult(new { error = "Missing Credentials" }) { StatusCode = 400 };

        string username = data["username"] ?? "";
        string password = data["password"] ?? "";

        if (!Regex.IsMatch(username, @"^[A-Za-z0-9-]+$") || password == "" || password.Any(char.IsWhiteSpace) || password.Length > 12) return new JsonResult(new { error = "Invalid Credentials Values" }) { StatusCode = 400 };

        SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
        connection.Open();

        SqliteCommand userCommand = connection.CreateCommand();
        userCommand.CommandText = "SELECT password_hash, role FROM users WHERE username = @username";
        userCommand.Parameters.AddWithValue("@username", username);
        SqliteDataReader userReader = userCommand.ExecuteReader();

        if (userReader.Read()) {
            string storedPasswordHash = userReader["password_hash"].ToString() ?? "";

            if (BCryptNet.Verify(password, storedPasswordHash)) {
                string role = userReader["role"].ToString() ?? "";

                SqliteCommand lastLoginCommand = connection.CreateCommand();
                lastLoginCommand.CommandText = "UPDATE users SET last_login = @last_login WHERE username = @username";
                lastLoginCommand.Parameters.AddWithValue("@last_login", DateTime.UtcNow.ToString("o"));
                lastLoginCommand.Parameters.AddWithValue("@username", username);
                lastLoginCommand.ExecuteNonQuery();

                string token = Guid.NewGuid().ToString();
                DateTime expiresAt = DateTime.UtcNow.AddDays(7);

                SqliteCommand sessionCommand = connection.CreateCommand();
                sessionCommand.CommandText = "INSERT INTO sessions (token, username, expires_at) VALUES (@token, @username, @expires_at)";
                sessionCommand.Parameters.AddWithValue("@token", token);
                sessionCommand.Parameters.AddWithValue("@username", username);
                sessionCommand.Parameters.AddWithValue("@expires_at", expiresAt.ToString("o"));
                sessionCommand.ExecuteNonQuery();

                Response.Cookies.Append("session_token", token, new CookieOptions {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.Lax,
                    Expires = expiresAt
                });

                connection.Close();
                return new JsonResult(new { success = "Logged In Successfully", role, has_profile_picture = System.IO.File.Exists($"wwwroot/profile-pictures/users/{username}.png") });
            }
        }

        connection.Close();
        return new JsonResult(new { error = "Invalid Credentials" }) { StatusCode = 401 };
    }

    public IActionResult OnPostSignUp([FromBody] Dictionary<string, string> data) {
        if (!data.ContainsKey("username") || !data.ContainsKey("password")) return new JsonResult(new { error = "Missing Credentials" }) { StatusCode = 400 };

        string username = data["username"] ?? "";
        string password = data["password"] ?? "";

        if (!Regex.IsMatch(username, @"^[A-Za-z0-9-]+$") || password == "" || password.Any(char.IsWhiteSpace) || password.Length > 12) return new JsonResult(new { error = "Invalid Credentials Values" }) { StatusCode = 400 };

        SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
        connection.Open();

        SqliteCommand userExistsCommand = connection.CreateCommand();
        userExistsCommand.CommandText = "SELECT 1 FROM users WHERE username = @username";
        userExistsCommand.Parameters.AddWithValue("@username", username);
        bool userExists = userExistsCommand.ExecuteScalar() != null;

        if (userExists) {
            connection.Close();
            return new JsonResult(new { error = "User Already Exists" }) { StatusCode = 409 };
        }

        if (data.ContainsKey("profile_picture")) {
            try {
                string profile_picture = data["profile_picture"] ?? "";

                Image image = Image.Load(Convert.FromBase64String(profile_picture));
                int size = Math.Min(image.Width, image.Height);

                image.Mutate((modify) => {
                    modify.Crop(new Rectangle((image.Width - size) / 2, (image.Height - size) / 2, size, size));
                    modify.Resize(400, 400);
                });

                image.SaveAsPng($"wwwroot/profile-pictures/users/{username}.png");

                image.Dispose();
            } catch {
                connection.Close();
                return new JsonResult(new { error = "Invalid Profile Picture" }) { StatusCode = 400 };
            }
        }

        SqliteCommand userCommand = connection.CreateCommand();
        userCommand.CommandText = "INSERT INTO users (username, password_hash, role) VALUES (@username, @password_hash, @role)";
        userCommand.Parameters.AddWithValue("@username", username);
        userCommand.Parameters.AddWithValue("@password_hash", BCryptNet.HashPassword(password, 12));
        userCommand.Parameters.AddWithValue("@role", "user");
        userCommand.ExecuteNonQuery();

        connection.Close();
        return new JsonResult(new { success = "Account Created Successfully" }) { StatusCode = 201 };
    }

    public IActionResult OnPostEditProfile([FromBody] Dictionary<string, string> data) {
        string token = Request.Cookies["session_token"] ?? "";

        if (token != "") {
            SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
            connection.Open();

            SqliteCommand sessionCommand = connection.CreateCommand();
            sessionCommand.CommandText = "SELECT username, expires_at FROM sessions WHERE token = @token";
            sessionCommand.Parameters.AddWithValue("@token", token);
            SqliteDataReader sessionReader = sessionCommand.ExecuteReader();

            if (sessionReader.Read()) {
                string sessionUsername = sessionReader["username"].ToString() ?? "";
                DateTime expiresAt = DateTime.Parse(sessionReader["expires_at"].ToString() ?? "");

                if (expiresAt > DateTime.UtcNow) {
                    if (!data.ContainsKey("old_username")) {
                        connection.Close();
                        return new JsonResult(new { error = "Missing Credentials" }) { StatusCode = 400 };
                    }

                    string oldUsername = data["old_username"] ?? "";

                    SqliteCommand sessionRoleCommand = connection.CreateCommand();
                    sessionRoleCommand.CommandText = "SELECT role FROM users WHERE username = @session_username";
                    sessionRoleCommand.Parameters.AddWithValue("@session_username", sessionUsername);
                    string sessionRole = sessionRoleCommand.ExecuteScalar()?.ToString() ?? "";

                    SqliteCommand oldUsernameRoleCommand = connection.CreateCommand();
                    oldUsernameRoleCommand.CommandText = "SELECT role FROM users WHERE username = @old_username";
                    oldUsernameRoleCommand.Parameters.AddWithValue("@old_username", oldUsername);
                    string oldUsernameRole = oldUsernameRoleCommand.ExecuteScalar()?.ToString() ?? "";

                    if (oldUsernameRole == "") {
                        connection.Close();
                        return new JsonResult(new { error = "Invalid Old Username" }) { StatusCode = 400 };
                    }

                    if ((data.ContainsKey("new_role") && sessionRole != "super_admin") || (sessionUsername != oldUsername && (sessionRole == "user" || (sessionRole == "admin" && (oldUsernameRole == "admin" || oldUsernameRole == "super_admin"))))) {
                        connection.Close();
                        return new JsonResult(new { error = "The User Is Not Authorized To Perform This Action" }) { StatusCode = 403 };
                    }

                    string newUsername = data.ContainsKey("new_username") ? (data["new_username"] ?? "") : "";
                    string newPassword = data.ContainsKey("new_password") ? (data["new_password"] ?? "") : "";
                    string newRole = data.ContainsKey("new_role") ? (data["new_role"] ?? "") : oldUsernameRole;
                    string deleteProfilePicture = data.ContainsKey("delete_profile_picture") ? (data["delete_profile_picture"] ?? "") : "";

                    if ((data.ContainsKey("new_username") && !Regex.IsMatch(newUsername, @"^[A-Za-z0-9-]+$")) || (data.ContainsKey("new_password") && (newPassword == "" || newPassword.Any(char.IsWhiteSpace) || newPassword.Length > 12)) || !(newRole == "user" || newRole == "admin" || newRole == "super_admin")) {
                        connection.Close();
                        return new JsonResult(new { error = "Invalid Credentials Values" }) { StatusCode = 400 };
                    }

                    if (data.ContainsKey("profile_picture")) {
                        try {
                            string profile_picture = data["profile_picture"] ?? "";

                            Image image = Image.Load(Convert.FromBase64String(profile_picture));
                            int size = Math.Min(image.Width, image.Height);

                            image.Mutate((modify) => {
                                modify.Crop(new Rectangle((image.Width - size) / 2, (image.Height - size) / 2, size, size));
                                modify.Resize(400, 400);
                            });

                            image.SaveAsPng($"wwwroot/profile-pictures/users/{oldUsername}.png");

                            image.Dispose();
                        } catch {
                            connection.Close();
                            return new JsonResult(new { error = "Invalid Profile Picture" }) { StatusCode = 400 };
                        }
                    } else if (deleteProfilePicture == "true") {
                        System.IO.File.Delete($"wwwroot/profile-pictures/users/{oldUsername}.png");
                    }

                    if (oldUsername == newUsername || newUsername == "") {
                        if (newPassword == "") {
                            SqliteCommand userCommand = connection.CreateCommand();
                            userCommand.CommandText = "UPDATE users SET role = @new_role WHERE username = @old_username";
                            userCommand.Parameters.AddWithValue("@new_role", newRole);
                            userCommand.Parameters.AddWithValue("@old_username", oldUsername);
                            userCommand.ExecuteNonQuery();
                        } else {
                            SqliteCommand userCommand = connection.CreateCommand();
                            userCommand.CommandText = "UPDATE users SET password_hash = @new_password_hash, role = @new_role WHERE username = @old_username";
                            userCommand.Parameters.AddWithValue("@new_password_hash", BCryptNet.HashPassword(newPassword, 12));
                            userCommand.Parameters.AddWithValue("@new_role", newRole);
                            userCommand.Parameters.AddWithValue("@old_username", oldUsername);
                            userCommand.ExecuteNonQuery();
                        }
                    } else {
                        SqliteCommand userExistsCommand = connection.CreateCommand();
                        userExistsCommand.CommandText = "SELECT 1 FROM users WHERE username = @new_username";
                        userExistsCommand.Parameters.AddWithValue("@new_username", newUsername);
                        bool userExists = userExistsCommand.ExecuteScalar() != null;

                        if (userExists) {
                            connection.Close();
                            return new JsonResult(new { error = "User Already Exists" }) { StatusCode = 409 };
                        }

                        if (newPassword == "") {
                            SqliteCommand userCommand = connection.CreateCommand();
                            userCommand.CommandText = "UPDATE users SET username = @new_username, role = @new_role WHERE username = @old_username";
                            userCommand.Parameters.AddWithValue("@new_username", newUsername);
                            userCommand.Parameters.AddWithValue("@new_role", newRole);
                            userCommand.Parameters.AddWithValue("@old_username", oldUsername);
                            userCommand.ExecuteNonQuery();
                        } else {
                            SqliteCommand userCommand = connection.CreateCommand();
                            userCommand.CommandText = "UPDATE users SET username = @new_username, password_hash = @new_password_hash, role = @new_role WHERE username = @old_username";
                            userCommand.Parameters.AddWithValue("@new_username", newUsername);
                            userCommand.Parameters.AddWithValue("@new_password_hash", BCryptNet.HashPassword(newPassword, 12));
                            userCommand.Parameters.AddWithValue("@new_role", newRole);
                            userCommand.Parameters.AddWithValue("@old_username", oldUsername);
                            userCommand.ExecuteNonQuery();
                        }

                        SqliteCommand sessionsCommand = connection.CreateCommand();
                        sessionsCommand.CommandText = "UPDATE sessions SET username = @new_username WHERE username = @old_username";
                        sessionsCommand.Parameters.AddWithValue("@new_username", newUsername);
                        sessionsCommand.Parameters.AddWithValue("@old_username", oldUsername);
                        sessionsCommand.ExecuteNonQuery();

                        SqliteCommand whiteGamesCommand = connection.CreateCommand();
                        whiteGamesCommand.CommandText = "UPDATE games SET white = @new_username WHERE white = @old_username";
                        whiteGamesCommand.Parameters.AddWithValue("@new_username", newUsername);
                        whiteGamesCommand.Parameters.AddWithValue("@old_username", oldUsername);
                        whiteGamesCommand.ExecuteNonQuery();

                        SqliteCommand blackGamesCommand = connection.CreateCommand();
                        blackGamesCommand.CommandText = "UPDATE games SET black = @new_username WHERE black = @old_username";
                        blackGamesCommand.Parameters.AddWithValue("@new_username", newUsername);
                        blackGamesCommand.Parameters.AddWithValue("@old_username", oldUsername);
                        blackGamesCommand.ExecuteNonQuery();

                        if (System.IO.File.Exists($"wwwroot/profile-pictures/users/{oldUsername}.png")) System.IO.File.Move($"wwwroot/profile-pictures/users/{oldUsername}.png", $"wwwroot/profile-pictures/users/{newUsername}.png");
                    }

                    connection.Close();
                    return new JsonResult(new { success = "Changes Saved Successfully" });
                }
            }

            connection.Close();
        }

        return new JsonResult(new { error = "The User Is Not Logged In" }) { StatusCode = 401 };
    }

    public IActionResult OnGetLeaderboard() {
        SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
        connection.Open();

        SqliteCommand usersCommand = connection.CreateCommand();
        usersCommand.CommandText = "SELECT username FROM users";
        SqliteDataReader usersReader = usersCommand.ExecuteReader();

        List<Dictionary<string, string>> leaderboard = new List<Dictionary<string, string>>();

        while (usersReader.Read()) {
            string username = usersReader["username"].ToString() ?? "";

            SqliteCommand gamesCommand = connection.CreateCommand();
            gamesCommand.CommandText = "SELECT * FROM games WHERE white = @username OR black = @username";
            gamesCommand.Parameters.AddWithValue("@username", username);
            SqliteDataReader gamesReader = gamesCommand.ExecuteReader();

            int won = 0;
            int draw = 0;
            int lost = 0;

            while (gamesReader.Read()) {
                if (gamesReader["winner"].ToString() == "draw") {
                    draw++;
                } else if (gamesReader[gamesReader["winner"].ToString() ?? ""].ToString() == username) {
                    won++;
                } else {
                    lost++;
                }
            }

            leaderboard.Add(new Dictionary<string, string> {
                { "rank", "" },
                { "player", username },
                { "rating", (800 + 10 * (won - lost)).ToString() },
                { "won", won.ToString() },
                { "draw", draw.ToString() },
                { "lost", lost.ToString() }
            });
        }

        leaderboard.Sort((a, b) => int.Parse(b["rating"]) - int.Parse(a["rating"]));

        for (int i = 0 ; i < leaderboard.Count ; i++) {
            leaderboard[i]["rank"] = (i + 1).ToString();
        }

        connection.Close();
        return new JsonResult(leaderboard);
    }

    public IActionResult OnGetHistory() {
        string token = Request.Cookies["session_token"] ?? "";

        if (token != "") {
            SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
            connection.Open();

            SqliteCommand sessionCommand = connection.CreateCommand();
            sessionCommand.CommandText = "SELECT username, expires_at FROM sessions WHERE token = @token";
            sessionCommand.Parameters.AddWithValue("@token", token);
            SqliteDataReader sessionReader = sessionCommand.ExecuteReader();

            if (sessionReader.Read()) {
                string username = sessionReader["username"].ToString() ?? "";
                DateTime expiresAt = DateTime.Parse(sessionReader["expires_at"].ToString() ?? "");

                if (expiresAt > DateTime.UtcNow) {
                    SqliteCommand gamesCommand = connection.CreateCommand();
                    gamesCommand.CommandText = "SELECT * FROM games WHERE white = @username OR black = @username ORDER BY date DESC";
                    gamesCommand.Parameters.AddWithValue("@username", username);
                    SqliteDataReader gamesReader = gamesCommand.ExecuteReader();

                    List<Dictionary<string, string>> history = new List<Dictionary<string, string>>();

                    while (gamesReader.Read()) {
                        history.Add(new Dictionary<string, string> {
                            { "white", gamesReader["white"].ToString() ?? "" },
                            { "black", gamesReader["black"].ToString() ?? "" },
                            { "result", gamesReader["winner"].ToString() == "draw" ? "draw" : (gamesReader[gamesReader["winner"].ToString() ?? ""].ToString() == username ? "won" : "lost") },
                            { "date", DateTime.Parse(gamesReader["date"].ToString() ?? "").ToString("dd/MM/yy") }
                        });
                    }

                    connection.Close();
                    return new JsonResult(history);
                }
            }

            connection.Close();
        }

        return new JsonResult(new { error = "The User Is Not Logged In" }) { StatusCode = 401 };
    }

    public IActionResult OnGetUsers() {
        string token = Request.Cookies["session_token"] ?? "";

        if (token != "") {
            SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
            connection.Open();

            SqliteCommand sessionCommand = connection.CreateCommand();
            sessionCommand.CommandText = "SELECT username, expires_at FROM sessions WHERE token = @token";
            sessionCommand.Parameters.AddWithValue("@token", token);
            SqliteDataReader sessionReader = sessionCommand.ExecuteReader();

            if (sessionReader.Read()) {
                DateTime expiresAt = DateTime.Parse(sessionReader["expires_at"].ToString() ?? "");

                if (expiresAt > DateTime.UtcNow) {
                    string username = sessionReader["username"].ToString() ?? "";

                    SqliteCommand roleCommand = connection.CreateCommand();
                    roleCommand.CommandText = "SELECT role FROM users WHERE username = @username";
                    roleCommand.Parameters.AddWithValue("@username", username);
                    string role = roleCommand.ExecuteScalar()?.ToString() ?? "";

                    if (role == "admin" || role == "super_admin") {
                        SqliteCommand usersCommand = connection.CreateCommand();
                        usersCommand.CommandText = "SELECT username, role, last_login FROM users ORDER BY username";
                        SqliteDataReader usersReader = usersCommand.ExecuteReader();

                        List<Dictionary<string, string>> users = new List<Dictionary<string, string>>();

                        while (usersReader.Read()) {
                            users.Add(new Dictionary<string, string> {
                                { "user", usersReader["username"].ToString() ?? "" },
                                { "role", usersReader["role"].ToString() ?? "" },
                                { "last_login", usersReader["last_login"] == DBNull.Value ? "" : DateTime.Parse(usersReader["last_login"].ToString() ?? "").ToString("dd/MM/yy") },
                                { "has_profile_picture", System.IO.File.Exists($"wwwroot/profile-pictures/users/{usersReader["username"].ToString() ?? ""}.png").ToString().ToLower() }
                            });
                        }

                        connection.Close();
                        return new JsonResult(users);
                    } else {
                        connection.Close();
                        return new JsonResult(new { error = "The User Is Not Authorized To Access This Data" }) { StatusCode = 403 };
                    }
                }
            }

            connection.Close();
        }

        return new JsonResult(new { error = "The User Is Not Logged In" }) { StatusCode = 401 };
    }
}