using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Data.Sqlite;

[IgnoreAntiforgeryToken]
public class IndexModel : PageModel {
    public IActionResult OnGetCheckLogin() {
        string token = Request.Cookies["session_token"] ?? "";

        if (token != "") {
            SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
            connection.Open();

            SqliteCommand tokenCommand = connection.CreateCommand();
            tokenCommand.CommandText = "SELECT username, expires_at FROM sessions WHERE token = @token";
            tokenCommand.Parameters.AddWithValue("@token", token);
            SqliteDataReader tokenReader = tokenCommand.ExecuteReader();

            if (tokenReader.Read()) {
                string username = tokenReader["username"].ToString() ?? "";
                DateTime expiresAt = DateTime.Parse(tokenReader["expires_at"].ToString() ?? "");

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
        string username = data["username"];
        string password = data["password"];

        SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
        connection.Open();

        SqliteCommand passwordCommand = connection.CreateCommand();
        passwordCommand.CommandText = "SELECT password FROM users WHERE username = @username";
        passwordCommand.Parameters.AddWithValue("@username", username);
        string storedPassword = passwordCommand.ExecuteScalar()?.ToString() ?? "";

        if (storedPassword != "" && storedPassword == password) {
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
        string username = data["username"];
        string password = data["password"];

        SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
        connection.Open();

        SqliteCommand passwordCommand = connection.CreateCommand();
        passwordCommand.CommandText = "SELECT password FROM users WHERE username = @username";
        passwordCommand.Parameters.AddWithValue("@username", username);
        bool userExists = passwordCommand.ExecuteScalar() != null;

        if (userExists) {
            connection.Close();
            return new JsonResult(new { error = "User Already Exists" }) { StatusCode = 409 };
        }

        SqliteCommand userCommand = connection.CreateCommand();
        userCommand.CommandText = "INSERT INTO users (username, password) VALUES (@username, @password)";
        userCommand.Parameters.AddWithValue("@username", username);
        userCommand.Parameters.AddWithValue("@password", password);
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

            SqliteCommand historyCommand = connection.CreateCommand();
            historyCommand.CommandText = "SELECT * FROM games WHERE white = @username OR black = @username";
            historyCommand.Parameters.AddWithValue("@username", username);
            SqliteDataReader historyReader = historyCommand.ExecuteReader();

            int won = 0;
            int draw = 0;
            int lost = 0;

            while (historyReader.Read()) {
                if (historyReader["winner"].ToString() == "draw") {
                    draw++;
                } else if (historyReader[historyReader["winner"].ToString() ?? ""].ToString() == username) {
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

            SqliteCommand tokenCommand = connection.CreateCommand();
            tokenCommand.CommandText = "SELECT username, expires_at FROM sessions WHERE token = @token";
            tokenCommand.Parameters.AddWithValue("@token", token);
            SqliteDataReader tokenReader = tokenCommand.ExecuteReader();

            if (tokenReader.Read()) {
                string username = tokenReader["username"].ToString() ?? "";
                DateTime expiresAt = DateTime.Parse(tokenReader["expires_at"].ToString() ?? "");

                if (expiresAt > DateTime.UtcNow) {
                    SqliteCommand historyCommand = connection.CreateCommand();
                    historyCommand.CommandText = "SELECT * FROM games WHERE white = @username OR black = @username ORDER BY date DESC";
                    historyCommand.Parameters.AddWithValue("@username", username);
                    SqliteDataReader historyReader = historyCommand.ExecuteReader();

                    List<Dictionary<string, string>> history = new List<Dictionary<string, string>>();

                    while (historyReader.Read()) {
                        history.Add(new Dictionary<string, string> {
                            { "white", historyReader["white"].ToString() ?? "" },
                            { "black", historyReader["black"].ToString() ?? "" },
                            { "result", historyReader["winner"].ToString() == "draw" ? "draw" : (historyReader[historyReader["winner"].ToString() ?? ""].ToString() == username ? "won" : "lost") },
                            { "date", DateTime.Parse(historyReader["date"].ToString() ?? "").ToString("dd/MM/yy") }
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