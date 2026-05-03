# pip3 install websockets requests

import asyncio, websockets, requests, json, sqlite3
from urllib.parse import urlparse, parse_qsl
from datetime import datetime, UTC

games = []

def log(title, game):
    title = f"==== {title} ===="

    print()
    print(title)
    print(f"White          |    {game["white"]["username"]}")
    print(f"Black          |    {game["black"]["username"]}")
    print(f"Total Games    |    {len(games)}")
    print("=" * len(title))

async def handler(ws):
    response = requests.get("http://localhost:5000?handler=CheckLogin", headers = { "Cookie": ws.request.headers.get("Cookie") })
    data = response.json()

    query_params = dict(parse_qsl(urlparse(ws.request.path).query))

    if response.ok and (query_params.get("player_color") == "white" or query_params.get("player_color") == "black") and query_params.get("opponent_username"):
        current_game = {}
        player_color = query_params["player_color"]
        action = "Started"

        for game in games:
            for color in [["white", "black"], ["black", "white"]]:
                if game[color[0]]["username"] == data["username"] and game[color[1]]["username"] == query_params["opponent_username"]:
                    game[color[0]]["ws"] = ws
                    current_game = game
                    player_color = color[0]
                    action = "Joined"
                    break

            if current_game:
                break

        if not current_game:
            if player_color == "white":
                current_game = {
                    "white": { "username": data["username"], "ws": ws },
                    "black": { "username": query_params["opponent_username"], "ws": None },
                    "game_string": ""
                }
            else:
                current_game = {
                    "white": { "username": query_params["opponent_username"], "ws": None },
                    "black": { "username": data["username"], "ws": ws },
                    "game_string": ""
                }

            games.append(current_game)

        opponent_color = "black" if player_color == "white" else "white"

        log(f"{data["username"]} {action} A Game", current_game)

        await ws.send(json.dumps({ "player_color": player_color, "game_string": current_game["game_string"] }))

        try:
            async for message in ws:
                if (json.loads(message).get("move")):
                    current_game["game_string"] = message

                    if current_game[opponent_color]["ws"]:
                        await current_game[opponent_color]["ws"].send(message)

                if (current_game in games and json.loads(message).get("winner")):
                    games.remove(current_game)

                    connection = sqlite3.connect("App_Data/Database.sqlite3")
                    cursor = connection.cursor()

                    cursor.execute("INSERT INTO games (white, black, winner, date) VALUES (:white, :black, :winner, :date)", {
                        "white": current_game["white"]["username"],
                        "black": current_game["black"]["username"],
                        "winner": json.loads(message)["winner"],
                        "date": datetime.now(UTC).isoformat()
                    })

                    connection.commit()
                    connection.close()

        except websockets.exceptions.ConnectionClosed:
            pass

        finally:
            current_game[player_color]["ws"] = None

            if current_game in games and not current_game["white"]["ws"] and not current_game["black"]["ws"]:
                games.remove(current_game)

            log(f"{data["username"]} Disconnected From A Game", current_game)

    else:
        await ws.send("error")

async def main():
    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("The WebSocket Relay Has Started Successfully On: ws://localhost:8765")
        await asyncio.Future()

asyncio.run(main())