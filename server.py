import asyncio, websockets, json

clients = set()
game_string = ""

async def handler(ws):
    global game_string

    clients.add(ws)
    print("Client Connected    | Total Clients:", len(clients))
    await ws.send(game_string)

    try:
        async for message in ws:
            game_string = message

            for client in clients:
                if client != ws:
                    await client.send(game_string)

            if (json.loads(game_string)["gameover"]): game_string = ""

    except websockets.exceptions.ConnectionClosed:
        pass

    finally:
        clients.remove(ws)
        print("Client Disconnected | Total Clients:", len(clients))

        if len(clients) == 0: game_string = ""

async def main():
    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("The WebSocket Relay Has Started Successfully On: ws://localhost:8765")
        await asyncio.Future()

asyncio.run(main())