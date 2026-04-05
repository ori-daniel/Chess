// dotnet add package Microsoft.Data.Sqlite

using System.Diagnostics;
using Microsoft.Data.Sqlite;

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

app.UseStaticFiles();
app.UseRouting();
app.MapRazorPages();

app.Run();