using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;
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
                string username = sessionReader["username"].ToString() ?? "";
                DateTime expiresAt = DateTime.Parse(sessionReader["expires_at"].ToString() ?? "");

                if (expiresAt > DateTime.UtcNow) {
                    connection.Close();
                    return new JsonResult(new { success = "The User Is Logged In", username });
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

        SqliteCommand passwordHashCommand = connection.CreateCommand();
        passwordHashCommand.CommandText = "SELECT password_hash FROM users WHERE username = @username";
        passwordHashCommand.Parameters.AddWithValue("@username", username);
        string storedPasswordHash = passwordHashCommand.ExecuteScalar()?.ToString() ?? "";

        if (storedPasswordHash != "" && BCryptNet.Verify(password, storedPasswordHash)) {
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
            return new JsonResult(new { success = "Logged In Successfully" });
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

        SqliteCommand userCommand = connection.CreateCommand();
        userCommand.CommandText = "INSERT INTO users (username, password_hash) VALUES (@username, @password_hash)";
        userCommand.Parameters.AddWithValue("@username", username);
        userCommand.Parameters.AddWithValue("@password_hash", BCryptNet.HashPassword(password, 12));
        userCommand.ExecuteNonQuery();

        connection.Close();
        return new JsonResult(new { success = "Account Created Successfully" }) { StatusCode = 201 };
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
                { "player", username },
                { "rating", (800 + 10 * (won - lost)).ToString() },
                { "won", won.ToString() },
                { "draw", draw.ToString() },
                { "lost", lost.ToString() }
            });
        }

        leaderboard.Sort((a, b) => int.Parse(b["rating"]) - int.Parse(a["rating"]));

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
}