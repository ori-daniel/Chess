// dotnet add package Microsoft.Data.Sqlite
// dotnet add package SixLabors.ImageSharp --version 3.1.12
// dotnet add package BCrypt.Net-Next

using System.Diagnostics;
using Microsoft.Data.Sqlite;
using System.Text.RegularExpressions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();

var app = builder.Build();

Process.Start("python3", "-u server.py");

_ = Task.Run(async () => {
    while (true) {
        SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
        connection.Open();

        SqliteCommand sessionsCommand = connection.CreateCommand();
        sessionsCommand.CommandText = "DELETE FROM sessions WHERE expires_at <= @now";
        sessionsCommand.Parameters.AddWithValue("@now", DateTime.UtcNow.ToString("o"));
        sessionsCommand.ExecuteNonQuery();

        connection.Close();

        await Task.Delay(TimeSpan.FromHours(1));
    }
});

app.Use((context, next) => {
    if (Regex.IsMatch(context.Request.Path, @"^/profile-pictures/users/[^/]+\.png$") && !File.Exists("wwwroot" + context.Request.Path)) {
        SqliteConnection connection = new SqliteConnection("Data Source=App_Data/Database.sqlite3");
        connection.Open();

        SqliteCommand userExistsCommand = connection.CreateCommand();
        userExistsCommand.CommandText = "SELECT 1 FROM users WHERE username = @username";
        userExistsCommand.Parameters.AddWithValue("@username", Path.GetFileNameWithoutExtension(context.Request.Path));
        bool userExists = userExistsCommand.ExecuteScalar() != null;

        connection.Close();

        if (userExists) context.Request.Path = "/profile-pictures/generic/default.png";
    }

    return next();
});

app.UseStaticFiles();
app.UseRouting();
app.MapRazorPages();

app.Run();