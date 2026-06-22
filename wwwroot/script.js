let username, role, has_profile_picture, profile, players, AI_engine, AI_difficulty, gamemode, time, player_color, opponent_username, book_moves, stockfish_engine, timer, winner, undo_stack, moves_stack, fifty_move_counter, en_passant, castling, board, turn, board_states, transposition_table, minimax_start_time, ws, sfx, from_square;

reset_home();
switch_to_form("login");
check_login();

function reset_home() {
    if (stockfish_engine) {
        stockfish_engine.terminate();
        stockfish_engine = null;
    }

    winner = "pending";

    if (ws) {
        ws.close();
        ws = null;
    }

    document.querySelector(".home").style.display = "";
    document.querySelector(".game").style.display = "";

    switch_to_tab("play");

    update_players("people");
    update_AI_engine("local");
    update_AI_difficulty(10);
    update_gamemode("local");
    update_time("rapid");
    update_player_color("white");

    opponent_username = null;
    document.querySelector("#opponent-username input").value = "";
}

function switch_to_form(form) {
    document.getElementById(`${form == "login" ? "sign-up" : "login"}-form`).style.display = "none";
    document.getElementById(`${form}-form`).style.display = "";
    document.querySelector(`#${form}-form #username`).focus();
}

async function check_login() {
    document.querySelector(".loading-overlay").style.display = "flex";

    const response = await fetch("?handler=CheckLogin");

    document.querySelector(".loading-overlay").style.display = "";

    if (response.ok) {
        const data = await response.json();

        username = data.username;
        role = data.role;
        has_profile_picture = data.has_profile_picture;

        document.querySelector(".login").style.display = "none";
        document.querySelector(".home .profile-picture").src = `/profile-pictures/users/${username}.png`;
        document.querySelector("h1").innerHTML = `Welcome To Chess, ${username}!`;

        if (role == "admin" || role == "super_admin") document.getElementById("users-tab-button").style.display = "flex";
    }
}

function validate_usename(username_input) {
    username_input.value = username_input.value.replace(/[^A-Za-z0-9-]/g, "");
}

function validate_password(password_input) {
    password_input.value = password_input.value.replace(/\s/g, "").slice(0, 12);

    password_input.parentElement.querySelector(".toggle-password-visibility-button").style.display = password_input.value ? "block" : "";
}

function toggle_password_visibility(toggle_password_visibility_button) {
    const password_input = toggle_password_visibility_button.parentElement.querySelector("#password");

    if (password_input.type == "password") {
        password_input.type = "text";
        password_input.style.letterSpacing = "normal";
        toggle_password_visibility_button.classList.remove("fa-eye-slash");
        toggle_password_visibility_button.classList.add("fa-eye");
    } else {
        password_input.type = "password";
        password_input.style.letterSpacing = "";
        toggle_password_visibility_button.classList.remove("fa-eye");
        toggle_password_visibility_button.classList.add("fa-eye-slash");
    }
}

async function login(event) {
    event.preventDefault();

    document.querySelector(".loading-overlay").style.display = "flex";

    const response = await fetch("?handler=Login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: document.querySelector("#login-form #username").value, 
            password: document.querySelector("#login-form #password").value 
        })
    });

    const data = await response.json();

    document.querySelector(".loading-overlay").style.display = "";

    if (response.ok) {
        username = document.querySelector("#login-form #username").value;
        role = data.role;
        has_profile_picture = data.has_profile_picture;

        document.querySelector(".login").style.display = "none";
        document.querySelector(".home .profile-picture").src = `/profile-pictures/users/${username}.png`;
        document.querySelector("h1").innerHTML = `Welcome To Chess, ${username}!`;

        if (role == "admin" || role == "super_admin") document.getElementById("users-tab-button").style.display = "flex";
    } else {
        document.querySelector("#login-form #error-message").style.display = "flex";
        document.querySelector("#login-form #error-text").innerHTML = data.error;

        setTimeout(() => {
            document.querySelector("#login-form #error-message").style.display = "";
            document.querySelector("#login-form #error-text").innerHTML = "";
        }, 1500);
    }
}

function clear_profile_picture(clear_profile_picture_button) {
    clear_profile_picture_button.parentElement.querySelector("img").src = "/profile-pictures/generic/default.png";
    clear_profile_picture_button.style.display = "";
    clear_profile_picture_button.parentElement.querySelector("input").value = "";
}

function upload_profile_picture(upload_profile_picture_button) {
    upload_profile_picture_button.parentElement.querySelector("input").click();
}

async function update_profile_picture(profile_picture_upload) {
    if (profile_picture_upload.files[0]) {
        const image = await createImageBitmap(profile_picture_upload.files[0]);
        const size = Math.min(image.width, image.height);
        const canvas = new OffscreenCanvas(400, 400);

        canvas.getContext("2d").drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 400, 400);

        const data_transfer = new DataTransfer();
        data_transfer.items.add(new File([await canvas.convertToBlob({ type: "image/png" })], "profile-picture.png", { type: "image/png" }));

        profile_picture_upload.files = data_transfer.files;

        profile_picture_upload.parentElement.querySelector("img").src = URL.createObjectURL(profile_picture_upload.files[0]);
        profile_picture_upload.parentElement.querySelector("#clear-profile-picture-button").style.display = "flex";
    }
}

async function sign_up(event) {
    event.preventDefault();

    document.querySelector(".loading-overlay").style.display = "flex";

    const data = {
        username: document.querySelector("#sign-up-form #username").value, 
        password: document.querySelector("#sign-up-form #password").value
    };

    const profile_picture_file = document.querySelector("#sign-up-form .profile-picture-upload input").files[0];

    if (profile_picture_file) {
        const file_reader = new FileReader();

        file_reader.readAsDataURL(profile_picture_file);
        await new Promise((resolve) => file_reader.onload = resolve);

        data.profile_picture = file_reader.result.split(",")[1];
    }

    const response = await fetch("?handler=SignUp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    document.querySelector(".loading-overlay").style.display = "";

    if (response.ok) {
        const success_message = document.querySelector("#sign-up-form #success-message");

        success_message.style.display = "flex";

        for (const element of document.querySelectorAll("#sign-up-form #clear-profile-picture-button, #sign-up-form input, #sign-up-form .submit-button")) {
            element.disabled = true;
        }

        document.querySelector("#login-form #username").value = document.querySelector("#sign-up-form #username").value;
        document.querySelector("#login-form #password").value = "";
        document.querySelector("#login-form #password").type = "password";
        document.querySelector("#login-form #password").style.letterSpacing = "";
        document.querySelector("#login-form .toggle-password-visibility-button").style.display = "";
        document.querySelector("#login-form .toggle-password-visibility-button").classList.remove("fa-eye");
        document.querySelector("#login-form .toggle-password-visibility-button").classList.add("fa-eye-slash");

        setTimeout(() => {
            success_message.style.display = "";

            clear_profile_picture(document.querySelector("#sign-up-form #clear-profile-picture-button"));

            for (const element of document.querySelectorAll("#sign-up-form #clear-profile-picture-button, #sign-up-form input, #sign-up-form .submit-button")) {
                element.disabled = false;
            }

            document.querySelector("#sign-up-form #username").value = "";
            document.querySelector("#sign-up-form #password").value = "";
            document.querySelector("#sign-up-form #password").type = "password";
            document.querySelector("#sign-up-form #password").style.letterSpacing = "";
            document.querySelector("#sign-up-form .toggle-password-visibility-button").style.display = "";
            document.querySelector("#sign-up-form .toggle-password-visibility-button").classList.remove("fa-eye");
            document.querySelector("#sign-up-form .toggle-password-visibility-button").classList.add("fa-eye-slash");

            switch_to_form("login");
        }, 1500);
    } else {
        const data = await response.json();

        document.querySelector("#sign-up-form #error-message").style.display = "flex";
        document.querySelector("#sign-up-form #error-text").innerHTML = data.error;

        setTimeout(() => {
            document.querySelector("#sign-up-form #error-message").style.display = "";
            document.querySelector("#sign-up-form #error-text").innerHTML = "";
        }, 1500);
    }
}

function show_edit_profile(user_profile) {
    profile = user_profile ?? { username, role, has_profile_picture };

    document.querySelector(".edit-profile").style.display = "flex";

    if (profile.has_profile_picture) {
        document.querySelector("#edit-profile-form .profile-picture-upload img").src = `/profile-pictures/users/${profile.username}.png`;
        document.querySelector("#edit-profile-form #clear-profile-picture-button").style.display = "flex";
    }

    document.querySelector("#edit-profile-form #username").value = profile.username;

    if (role == "super_admin") document.getElementById("role-selector").style.display = "flex";

    document.querySelector("#role-selector select").value = profile.role;

    if (profile.username != username) document.querySelector("#edit-profile-form .switch-form-button").style.display = "none";
}

function hide_edit_profile() {
    profile = null;

    clear_profile_picture(document.querySelector("#edit-profile-form #clear-profile-picture-button"));

    document.querySelector("#edit-profile-form #username").value = "";
    document.querySelector("#edit-profile-form #password").value = "";
    document.querySelector("#edit-profile-form #password").type = "password";
    document.querySelector("#edit-profile-form #password").style.letterSpacing = "";
    document.querySelector("#edit-profile-form .toggle-password-visibility-button").style.display = "";
    document.querySelector("#edit-profile-form .toggle-password-visibility-button").classList.remove("fa-eye");
    document.querySelector("#edit-profile-form .toggle-password-visibility-button").classList.add("fa-eye-slash");
    document.getElementById("role-selector").style.display = "";
    document.querySelector("#role-selector select").selectedIndex = 0;
    document.querySelector("#edit-profile-form .switch-form-button").style.display = "";

    document.querySelector(".edit-profile").style.display = "";
}

async function edit_profile(event) {
    event.preventDefault();

    document.querySelector(".loading-overlay").style.display = "flex";

    const data = { old_username: profile.username };

    if (document.querySelector("#edit-profile-form #username").value != profile.username) data.new_username = document.querySelector("#edit-profile-form #username").value;

    if (document.querySelector("#edit-profile-form #password").value) data.new_password = document.querySelector("#edit-profile-form #password").value;

    if (document.querySelector("#role-selector select").value != profile.role) data.new_role = document.querySelector("#role-selector select").value;

    const profile_picture_file = document.querySelector("#edit-profile-form .profile-picture-upload input").files[0];

    if (profile_picture_file) {
        const file_reader = new FileReader();

        file_reader.readAsDataURL(profile_picture_file);
        await new Promise((resolve) => file_reader.onload = resolve);

        data.profile_picture = file_reader.result.split(",")[1];
    } else if (profile.has_profile_picture && !document.querySelector("#edit-profile-form #clear-profile-picture-button").style.display) {
        data.delete_profile_picture = "true";
    }

    const response = await fetch("?handler=EditProfile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    document.querySelector(".loading-overlay").style.display = "";

    if (response.ok) {
        const success_message = document.querySelector("#edit-profile-form #success-message");

        success_message.style.display = "flex";

        for (const element of document.querySelectorAll("#edit-profile-form #clear-profile-picture-button, #edit-profile-form input, #edit-profile-form .submit-button")) {
            element.disabled = true;
        }

        setTimeout(() => {
            success_message.style.display = "";

            for (const element of document.querySelectorAll("#edit-profile-form #clear-profile-picture-button, #edit-profile-form input, #edit-profile-form .submit-button")) {
                element.disabled = false;
            }

            const reload = profile.username == username;

            hide_edit_profile();

            if (reload) {
                window.location.reload();
            } else {
                switch_to_tab("users");
            }
        }, 1500);
    } else {
        const data = await response.json();

        document.querySelector("#edit-profile-form #error-message").style.display = "flex";
        document.querySelector("#edit-profile-form #error-text").innerHTML = data.error;

        setTimeout(() => {
            document.querySelector("#edit-profile-form #error-message").style.display = "";
            document.querySelector("#edit-profile-form #error-text").innerHTML = "";
        }, 1500);
    }
}

async function logout() {
    document.querySelector(".loading-overlay").style.display = "flex";

    const response = await fetch("?handler=Logout", { method: "POST" });

    document.querySelector(".loading-overlay").style.display = "";

    if (response.ok) {
        username = null;
        role = null;
        has_profile_picture = null;

        hide_edit_profile();

        document.querySelector(".login").style.display = "";

        for (const form of ["login", "sign-up"]) {
            document.querySelector(`#${form}-form #username`).value = "";
            document.querySelector(`#${form}-form #password`).value = "";
            document.querySelector(`#${form}-form #password`).type = "password";
            document.querySelector(`#${form}-form #password`).style.letterSpacing = "";
            document.querySelector(`#${form}-form .toggle-password-visibility-button`).style.display = "";
            document.querySelector(`#${form}-form .toggle-password-visibility-button`).classList.remove("fa-eye");
            document.querySelector(`#${form}-form .toggle-password-visibility-button`).classList.add("fa-eye-slash");
        }

        document.querySelector(".home .profile-picture").src = "/profile-pictures/generic/default.png";
        document.querySelector("h1").innerHTML = "Welcome To Chess!";
        document.getElementById("users-tab-button").style.display = "";

        reset_home();
        switch_to_form("login");
    }
}

async function switch_to_tab(tab) {
    document.querySelector(".selected-switch-tab-button")?.classList.remove("selected-switch-tab-button");
    document.getElementById(`${tab}-tab-button`).classList.add("selected-switch-tab-button");

    document.querySelector(`.${tab}-tab`).style.display = "";

    if (tab == "play") {
        document.querySelector(".leaderboard-tab").style.display = "none";
        document.querySelector(".history-tab").style.display = "none";
        document.querySelector(".users-tab").style.display = "none";

        if (players == "people" && gamemode == "online") document.querySelector("#opponent-username input").focus();
    } else if (tab == "leaderboard") {
        document.querySelector(".play-tab").style.display = "none";
        document.querySelector(".history-tab").style.display = "none";
        document.querySelector(".users-tab").style.display = "none";

        document.querySelector(".leaderboard-tab tbody").innerHTML = `
            <tr>
                <td colspan="100%" style="text-align: center; padding: 20px;">No Players Found</td>
            </tr>
        `;

        document.querySelector(".loading-overlay").style.display = "flex";

        const response = await fetch("?handler=Leaderboard");
        const data = await response.json();

        document.querySelector(".loading-overlay").style.display = "";

        if (response.ok) {
            let table_body = "";

            for (const player of data) {
                table_body += `
                    <tr>
                        <td>#${player.rank}</td>
                        <td>
                            <div>
                                <img src="/profile-pictures/users/${player.player}.png" />
                                <span>${player.player}</span>
                            </div>
                        </td>
                        <td>${player.rating}</td>
                        <td>${player.won}</td>
                        <td>${player.draw}</td>
                        <td>${player.lost}</td>
                    </tr>
                `;
            }

            if (table_body) document.querySelector(".leaderboard-tab tbody").innerHTML = table_body;
        }
    } else if (tab == "history") {
        document.querySelector(".play-tab").style.display = "none";
        document.querySelector(".leaderboard-tab").style.display = "none";
        document.querySelector(".users-tab").style.display = "none";

        document.querySelector(".history-tab tbody").innerHTML = `
            <tr>
                <td colspan="100%" style="text-align: center; padding: 20px;">No Games Found</td>
            </tr>
        `;

        document.querySelector(".loading-overlay").style.display = "flex";

        const response = await fetch("?handler=History");
        const data = await response.json();

        document.querySelector(".loading-overlay").style.display = "";

        if (response.ok) {
            let table_body = "";

            for (const game of data) {
                table_body += `
                    <tr>
                        <td>${game.white}</td>
                        <td>${game.black}</td>
                        <td>
                            <img src="/assets/home/history-tab/${game.result}.png" />
                        </td>
                        <td>${game.date}</td>
                    </tr>
                `;
            }

            if (table_body) document.querySelector(".history-tab tbody").innerHTML = table_body;
        }
    } else {
        document.querySelector(".play-tab").style.display = "none";
        document.querySelector(".leaderboard-tab").style.display = "none";
        document.querySelector(".history-tab").style.display = "none";

        document.querySelector(".users-tab tbody").innerHTML = `
            <tr>
                <td colspan="100%" style="text-align: center; padding: 20px;">No Users Found</td>
            </tr>
        `;

        document.querySelector(".loading-overlay").style.display = "flex";

        const response = await fetch("?handler=Users");
        const data = await response.json();

        document.querySelector(".loading-overlay").style.display = "";

        if (response.ok) {
            const role_map = { user: "User", admin: "Admin", super_admin: "Super Admin" };

            let table_body = "";

            for (const user of data) {
                const edit_button_html = user.user != username && role == "admin" && (user.role == "admin" || user.role == "super_admin") ? "" : `
                    <button onclick='show_edit_profile(${JSON.stringify({ username: user.user, role: user.role, has_profile_picture: user.has_profile_picture })})'>
                        <span class="fas fa-user-edit"></span>
                    </button>
                `;

                table_body += `
                    <tr>
                        <td>
                            <div>
                                <img src="/profile-pictures/users/${user.user}.png" />
                                <span>${user.user}</span>
                            </div>
                        </td>
                        <td>${role_map[user.role]}</td>
                        <td>${user.last_login}</td>
                        <td>${edit_button_html}</td>
                    </tr>
                `;
            }

            if (table_body) document.querySelector(".users-tab tbody").innerHTML = table_body;
        }
    }
}

function update_players(updated_players) {
    players = updated_players;

    document.querySelector("#players .selected-play-config-button")?.classList.remove("selected-play-config-button");
    document.getElementById(`play-${players}`).classList.add("selected-play-config-button");

    if (players == "AI") {
        document.getElementById("AI-engine").style.display = "";
        document.getElementById("AI-difficulty").style.display = "";
        document.getElementById("gamemode").style.display = "none";
        document.getElementById("time").style.display = "none";
        document.getElementById("player-color").style.display = "";
        document.querySelector("#player-color #white-color").src = "/assets/home/play-tab/player-color/white.png";
        document.querySelector("#player-color #black-color").src = "/assets/home/play-tab/player-color/black.png";
        document.getElementById("opponent-username").style.display = "none";
    } else if (players == "people") {
        document.getElementById("AI-engine").style.display = "none";
        document.getElementById("AI-difficulty").style.display = "none";
        document.getElementById("gamemode").style.display = "";
        document.getElementById("time").style.display = "";
        document.querySelector("#player-color #white-color").src = "/assets/home/play-tab/player-color/white.png";
        document.querySelector("#player-color #black-color").src = "/assets/home/play-tab/player-color/black.png";

        if (gamemode == "local") {
            document.getElementById("player-color").style.display = "none";
            document.getElementById("opponent-username").style.display = "none";
        } else {
            document.getElementById("player-color").style.display = "";
            document.getElementById("opponent-username").style.display = "";
            document.querySelector("#opponent-username input").focus();
        }
    } else {
        document.getElementById("AI-engine").style.display = "none";
        document.getElementById("AI-difficulty").style.display = "";
        document.getElementById("gamemode").style.display = "none";
        document.getElementById("time").style.display = "none";
        document.getElementById("player-color").style.display = "";
        document.querySelector("#player-color #white-color").src = "/assets/home/play-tab/AI-engine/local.png";
        document.querySelector("#player-color #black-color").src = "/assets/home/play-tab/AI-engine/stockfish.png";
        document.getElementById("opponent-username").style.display = "none";
    }
}

function update_AI_engine(updated_AI_engine) {
    AI_engine = updated_AI_engine;

    document.querySelector("#AI-engine .selected-play-config-button")?.classList.remove("selected-play-config-button");
    document.getElementById(`${AI_engine}-AI-engine`).classList.add("selected-play-config-button");
}

function update_AI_difficulty(updated_AI_difficulty) {
    if (0 < updated_AI_difficulty && updated_AI_difficulty < 21) {
        AI_difficulty = updated_AI_difficulty;

        document.querySelector("#AI-difficulty img").src = `/assets/home/play-tab/AI-difficulty/${AI_difficulty}.png`;
    }
}

function update_gamemode(updated_gamemode) {
    gamemode = updated_gamemode;

    document.querySelector("#gamemode .selected-play-config-button")?.classList.remove("selected-play-config-button");
    document.getElementById(`${gamemode}-play`).classList.add("selected-play-config-button");

    if (gamemode == "local") {
        document.getElementById("player-color").style.display = "none";
        document.getElementById("opponent-username").style.display = "none";
    } else {
        document.getElementById("player-color").style.display = "";
        document.getElementById("opponent-username").style.display = "";
        document.querySelector("#opponent-username input").focus();
    }
}

function update_time(updated_time) {
    time = updated_time;

    document.querySelector("#time .selected-play-config-button")?.classList.remove("selected-play-config-button");
    document.getElementById(`${time}-time`).classList.add("selected-play-config-button");
}

function update_player_color(updated_player_color) {
    player_color = updated_player_color;

    document.querySelector("#player-color .selected-play-config-button")?.classList.remove("selected-play-config-button");
    document.getElementById(`${player_color}-color`).classList.add("selected-play-config-button");
}

async function launch_game() {
    if (player_color == "random") player_color = Math.random() < 0.5 ? "white" : "black";

    if (players == "people" && gamemode == "online") {
        if (document.querySelector("#opponent-username input").checkValidity()) {
            opponent_username = document.querySelector("#opponent-username input").value;

            document.querySelector(".loading-overlay").style.display = "flex";

            ws = new WebSocket(`${location.hostname == "localhost" ? "ws://localhost:8765" : "wss://chess.oridaniel.com/ws"}?player_color=${player_color}&opponent_username=${opponent_username}`);

            ws.onmessage = async (event) => {
                if (event.data == "error") {
                    document.querySelector(".loading-overlay").style.display = "";

                    ws.close();
                } else {
                    const data = JSON.parse(event.data);

                    if (data.player_color) {
                        player_color = data.player_color;

                        if (data.game_string) {
                            await start_game(play_game_start_sfx=false);
                            load_game_string(data.game_string);

                            if (winner) {
                                ws.close();
                                ws = null;
                            }
                        } else {
                            await start_game();
                        }

                        document.querySelector(".loading-overlay").style.display = "";
                    } else {
                        load_game_string(event.data);

                        if (winner) {
                            ws.close();
                            ws = null;
                        }
                    }
                }
            }
        } else {
            document.querySelector("#opponent-username input").reportValidity();
        }
    } else {
        if (players == "people" && gamemode == "local") player_color = "white";

        await start_game();
    }
}

async function start_game(play_game_start_sfx=true) {
    const response = await fetch("opening-book.json");
    book_moves = await response.json();

    stockfish_engine = new Worker("/stockfish/stockfish-18-lite-single.js");
    stockfish_engine.postMessage("setoption name UCI_LimitStrength value true");
    stockfish_engine.postMessage("setoption name UCI_Elo value 1700");

    const time_map = { bullet: 1, blitz: 5, rapid: 10 };
    timer = { w: time_map[time] * 60, b: time_map[time] * 60 };

    document.querySelector(".home").style.display = "none";
    document.querySelector(".game").style.display = "flex";
    document.getElementById("undo-button").disabled = false;
    document.getElementById("undo-button").style.display = (players == "people" && gamemode == "online") || players == "watch" ? "none" : "";
    document.querySelector("#b-player .profile-picture").src = players == "AI" ? (player_color == "black" ? `/profile-pictures/users/${username}.png` : (AI_engine == "local" ? `/assets/home/play-tab/AI-difficulty/${AI_difficulty}.png` : "/assets/home/play-tab/AI-engine/stockfish.png")) : (players == "people" ? (gamemode == "local" ? "/profile-pictures/generic/black.png" : `/profile-pictures/users/${player_color == "black" ? username : opponent_username}.png`) : (player_color == "black" ? `/assets/home/play-tab/AI-difficulty/${AI_difficulty}.png` : "/assets/home/play-tab/AI-engine/stockfish.png"));
    document.querySelector("#b-player .username").innerHTML = players == "AI" ? (player_color == "black" ? username : `${AI_engine == "local" ? "Local AI" : "Stockfish"} Level ${AI_difficulty}`) : (players == "people" ? (gamemode == "local" ? "Black" : (player_color == "black" ? username : opponent_username)) : `${player_color == "black" ? "Local AI" : "Stockfish"} Level ${AI_difficulty}`);
    document.querySelector("#b-player .captured-pieces").innerHTML = "";
    document.querySelector("#b-player .captured-score").innerHTML = "";
    document.querySelector("#b-player .timer").style.display = players == "people" ? "" : "none";
    document.querySelector("#b-player .timer").style.backgroundColor = "";
    document.querySelector("#b-player .timer").style.opacity = 0.5;
    document.querySelector("#b-player .timer img").src = "/assets/game/timer/white-clock.png";
    document.querySelector("#b-player .timer img").style.transform = "";
    document.querySelector("#b-player .timer span").innerHTML = format_time(timer.b);
    document.querySelector("#b-player .timer span").style.color = "";
    document.querySelector(".board").style.pointerEvents = "";
    document.querySelector("#w-player .profile-picture").src = players == "AI" ? (player_color == "white" ? `/profile-pictures/users/${username}.png` : (AI_engine == "local" ? `/assets/home/play-tab/AI-difficulty/${AI_difficulty}.png` : "/assets/home/play-tab/AI-engine/stockfish.png")) : (players == "people" ? (gamemode == "local" ? "/profile-pictures/generic/white.png" : `/profile-pictures/users/${player_color == "white" ? username : opponent_username}.png`) : (player_color == "white" ? `/assets/home/play-tab/AI-difficulty/${AI_difficulty}.png` : "/assets/home/play-tab/AI-engine/stockfish.png"));
    document.querySelector("#w-player .username").innerHTML = players == "AI" ? (player_color == "white" ? username : `${AI_engine == "local" ? "Local AI" : "Stockfish"} Level ${AI_difficulty}`) : (players == "people" ? (gamemode == "local" ? "White" : (player_color == "white" ? username : opponent_username)) : `${player_color == "white" ? "Local AI" : "Stockfish"} Level ${AI_difficulty}`);
    document.querySelector("#w-player .captured-pieces").innerHTML = "";
    document.querySelector("#w-player .captured-score").innerHTML = "";
    document.querySelector("#w-player .timer").style.display = players == "people" ? "" : "none";
    document.querySelector("#w-player .timer").style.backgroundColor = "";
    document.querySelector("#w-player .timer").style.opacity = 1;
    document.querySelector("#w-player .timer img").src = "/assets/game/timer/black-clock.png";
    document.querySelector("#w-player .timer img").style.transform = "";
    document.querySelector("#w-player .timer span").innerHTML = format_time(timer.w);
    document.querySelector("#w-player .timer span").style.color = "";
    document.querySelector(".popup").style.display = "";

    winner = null;
    undo_stack = [];
    moves_stack = [];
    fifty_move_counter = 0;
    en_passant = { row: null, column: null };
    castling = {
        w: { kr: true, qr: true },
        b: { kr: true, qr: true }
    };
    board = [
        ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
        ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
        ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"]
    ];
    turn = "w";
    board_states = [get_board_state()];
    transposition_table = {};

    document.querySelector(".game").style.flexDirection = players == "watch" || player_color == "white" ? "column" : "column-reverse";
    const start = players == "watch" || player_color == "white" ? 0 : 7;
    const end = players == "watch" || player_color == "white" ? 8 : -1;
    const step = players == "watch" || player_color == "white" ? 1 : -1;

    let board_html = "";

    for (let row = start ; row != end ; row += step) {
        for (let column = start ; column != end ; column += step) {
            board_html += `
                <span class="${(row * 7 + column) % 2 == 0 ? "white" : "green"}-square" id="${row}${column}" onclick="click_square(this)" ondragstart="drag_start(this)" ondragover="drag_over(this, event)" ondragleave="drag_leave(this, event)" ondrop="drop(this)">
                    ${board[row][column] && `<img src="/assets/game/pieces/${board[row][column]}.png" />`}
                </span>
            `;
        }
    }

    document.querySelector(".board").innerHTML = board_html;

    if (play_game_start_sfx) (new Audio("/assets/game/sfx/game-start.webm")).play();

    if (players == "AI") {
        if (player_color == "black") setTimeout(() => play_AI_move(), 100);
    } else if (players == "people") {
        setTimeout(() => update_timer(), 1000);
    } else {
        AI_engine = player_color == "white" ? "local" : "stockfish";
        player_color = player_color == "white" ? "black" : "white";

        setTimeout(() => play_AI_move(), 100);
    }
}

function get_game_string(move) {
    return JSON.stringify({
        timer,
        winner,
        moves_stack,
        fifty_move_counter,
        en_passant,
        castling,
        board,
        turn,
        board_states,
        sfx,
        move
    });
}

function load_game_string(game_string) {
    const game = JSON.parse(game_string);

    timer = game.timer;
    winner = game.winner;
    moves_stack = game.moves_stack;
    fifty_move_counter = game.fifty_move_counter;
    en_passant = game.en_passant;
    castling = game.castling;
    board = game.board;
    turn = game.turn;
    board_states = game.board_states;
    sfx = game.sfx;

    document.querySelector(`#b-player .timer span`).innerHTML = format_time(timer.b);
    document.querySelector(`#w-player .timer span`).innerHTML = format_time(timer.w);

    render_board(game.move);
}

function format_time(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function update_timer() {
    if (!winner) {
        if (timer[turn]) {
            timer[turn]--;

            if (timer[turn] < 11) {
                document.querySelector(`#${turn}-player .timer`).style.backgroundColor = "#af1e22";
                document.querySelector(`#${turn}-player .timer img`).src = "/assets/game/timer/white-clock.png";
                document.querySelector(`#${turn}-player .timer span`).style.color = "white";

                if (timer[turn] == 10) (new Audio("/assets/game/sfx/tenseconds.webm")).play();
            }

            document.querySelector(`#${turn}-player .timer img`).style.transform = `rotate(${(-timer[turn] % 4) * 90}deg)`;
            document.querySelector(`#${turn}-player .timer span`).innerHTML = format_time(timer[turn]);

            setTimeout(() => update_timer(), 1000);
        } else {
            winner = turn == "w" ? "black" : "white";

            if (gamemode == "online") {
                ws.send(JSON.stringify({ winner }));
                ws.close();
                ws = null;
            }

            show_popup("Timeout!", `${gamemode == "local" ? (turn == "w" ? "Black" : "White") : (turn == player_color[0] ? opponent_username : username)} Won`);

            (new Audio("/assets/game/sfx/game-end.webm")).play();
        }
    }
}

function remove_overlays() {
    for (const overlay_type of ["highlight", "possible-move", "capture-move", "hover"]) {
        for (const overlay of document.querySelectorAll(`.${overlay_type}-overlay`)) {
            overlay.remove()
        }
    }
}

function click_square(square) {
    if (board[Math.floor(square.id / 10)][square.id % 10][0] == turn) {
        drag_start(square);
    } else {
        drop(square);
    }
}

function drag_start(square) {
    remove_overlays();

    if (board[Math.floor(square.id / 10)][square.id % 10][0] == turn && (players == "people" && gamemode == "local" ? true : player_color[0] == turn)) {
        from_square = square;

        square.insertAdjacentHTML("afterbegin", "<span class='highlight-overlay'></span>");

        for (const move of get_possible_moves(Math.floor(square.id / 10), square.id % 10)) {
            document.getElementById(`${move.row}${move.column}`).insertAdjacentHTML("beforeend", `<span class="${board[move.row][move.column] ? "capture" : "possible"}-move-overlay"></span>`);
        }
    }
}

function drag_over(square, event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (!square.querySelector(".hover-overlay")) square.insertAdjacentHTML("beforeend", "<span class='hover-overlay'></span>");
}

function drag_leave(square, event) {
    if (!square.contains(event.relatedTarget)) square.querySelector(".hover-overlay").remove();
}

function drop(square) {
    if (square.querySelector(".possible-move-overlay") || square.querySelector(".capture-move-overlay")) {
        const move = {
            from: { row: Math.floor(from_square.id / 10), column: from_square.id % 10 },
            to: { row: Math.floor(square.id / 10), column: square.id % 10 }
        };

        apply_move(move);
        render_board(move);

        if (!winner && players == "AI") {
            setTimeout(() => play_AI_move(), 100);
        } else if (players == "people" && gamemode == "online") {
            ws.send(get_game_string(move));

            if (winner) {
                ws.close();
                ws = null;
            }
        }
    } else {
        remove_overlays();

        (new Audio("/assets/game/sfx/illegal.webm")).play();
    }
}

function show_popup(title, description) {
    stockfish_engine.terminate();
    stockfish_engine = null;

    document.getElementById("undo-button").disabled = true;
    document.querySelector(`#${turn}-player .timer`).style.backgroundColor = "";
    document.querySelector(`#${turn}-player .timer img`).src = `/assets/game/timer/${turn == "w" ? "black" : "white"}-clock.png`;
    document.querySelector(`#${turn}-player .timer span`).style.color = "";
    document.querySelector(".board").style.pointerEvents = "none";
    document.querySelector(".popup").style.display = "flex";
    document.querySelector(".popup-title").innerHTML = title;
    document.querySelector(".popup-description").innerHTML = description;

    confetti({
        particleCount: 300,
        spread: 360,
        gravity: 0.7,
        ticks: 170,
        scalar: 1.7
    });
}

function hide_popup() {
    document.querySelector(".popup").style.display = "";
}

function undo(moves) {
    if (moves && undo_stack.length) {
        const move = undo_stack.length > 1 ? undo_stack.at(-2).move : null;
        const sfx_backup = sfx;

        undo_move();
        render_board(move, custom_sfx=sfx_backup);

        setTimeout(() => undo(moves - 1), 100);
    }
}

function render_board(move, custom_sfx=null) {
    const scores = { w: 0, b: 0 };
    const pieces = {
        w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
        b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }
    };
    const pieces_value_map = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column]) {
                document.getElementById(`${row}${column}`).innerHTML = `<img src="/assets/game/pieces/${board[row][column]}.png" />`;

                scores[board[row][column][0]] += pieces_value_map[board[row][column][1]];
                pieces[board[row][column][0]][board[row][column][1]]--;
            } else {
                document.getElementById(`${row}${column}`).innerHTML = "";
            }
        }
    }

    if (move) {
        document.getElementById(`${move.from.row}${move.from.column}`).innerHTML = "<span class='previous-move-highlight-overlay'></span>";
        document.getElementById(`${move.to.row}${move.to.column}`).insertAdjacentHTML("afterbegin", "<span class='previous-move-highlight-overlay'></span>");
    }

    for (const [color, opponent_color] of [["w", "b"], ["b", "w"]]) {
        let captured_pieces_html = "";

        for (const piece of Object.keys(pieces[opponent_color])) {
            if (pieces[opponent_color][piece] > 0) captured_pieces_html += `<img src="/assets/game/captured-pieces/${opponent_color}${piece}${pieces[opponent_color][piece]}.png" />`;
        }

        document.querySelector(`#${color}-player .captured-pieces`).innerHTML = captured_pieces_html;
    }

    if (scores.w == scores.b) {
        document.querySelector(`#b-player .captured-score`).innerHTML = "";
        document.querySelector(`#w-player .captured-score`).innerHTML = "";
    } else if (scores.w > scores.b) {
        document.querySelector(`#b-player .captured-score`).innerHTML = "";
        document.querySelector(`#w-player .captured-score`).innerHTML = `+${scores.w - scores.b}`;
    } else {
        document.querySelector(`#b-player .captured-score`).innerHTML = `+${scores.b - scores.w}`;
        document.querySelector(`#w-player .captured-score`).innerHTML = "";
    }

    document.querySelector(`#${turn}-player .timer`).style.opacity = 1;
    if (timer[turn] < 11) {
        document.querySelector(`#${turn}-player .timer`).style.backgroundColor = "#af1e22";
        document.querySelector(`#${turn}-player .timer img`).src = "/assets/game/timer/white-clock.png";
        document.querySelector(`#${turn}-player .timer span`).style.color = "white";
    }

    if (turn == "w") {
        document.querySelector(`#b-player .timer`).style.backgroundColor = "";
        document.querySelector(`#b-player .timer`).style.opacity = 0.5;
        document.querySelector(`#b-player .timer img`).src = "/assets/game/timer/white-clock.png";
        document.querySelector(`#b-player .timer span`).style.color = "";
    } else {
        document.querySelector(`#w-player .timer`).style.backgroundColor = "";
        document.querySelector(`#w-player .timer`).style.opacity = 0.5;
        document.querySelector(`#w-player .timer img`).src = "/assets/game/timer/black-clock.png";
        document.querySelector(`#w-player .timer span`).style.color = "";
    }

    const special_draw = get_special_draw();

    if (special_draw) {
        winner = "draw";

        show_popup("Draw!", special_draw);

        custom_sfx = "game-end";
    } else if (!is_possible_moves()) {
        if (in_check()) {
            winner = turn == "w" ? "black" : "white";

            show_popup("Checkmate!", `${players == "AI" ? (turn == player_color[0] ? `${AI_engine == "local" ? "Local AI" : "Stockfish"} Level ${AI_difficulty}` : username) : (players == "people" ? (gamemode == "local" ? (turn == "w" ? "Black" : "White") : (turn == player_color[0] ? opponent_username : username)) : `${AI_engine == "local" ? "Local AI" : "Stockfish"} Level ${AI_difficulty}`)} Won`);

            custom_sfx = "game-end";
        } else {
            winner = "draw";

            show_popup("Draw!", "Stalemate");

            custom_sfx = "game-end";
        }
    } else if (in_check()) {
        custom_sfx = "move-check";
    }

    (new Audio(`/assets/game/sfx/${custom_sfx ?? sfx}.webm`)).play();
}

function apply_move(move, update_turn=true) {
    const piece = board[move.from.row][move.from.column];

    undo_stack.push({
        move,
        moved_piece: piece,
        captured_piece: board[move.to.row][move.to.column],
        fifty_move_counter,
        en_passant: structuredClone(en_passant),
        castling: structuredClone(castling),
        turn,
        sfx
    });

    if (board[move.to.row][move.to.column]) {
        fifty_move_counter = 0;
        sfx = "capture";
    } else {
        fifty_move_counter++;
        sfx = "move-self";
    }

    board[move.to.row][move.to.column] = piece;
    board[move.from.row][move.from.column] = "";

    if (piece[1] == "p") {
        fifty_move_counter = 0;

        if (Math.abs(move.to.row - move.from.row) == 2) {
            en_passant.row = (move.from.row + move.to.row) / 2;
            en_passant.column = move.from.column;
        } else {
            if (en_passant.row == move.to.row && en_passant.column == move.to.column) {
                board[move.to.row + (piece[0] == "w" ? 1 : -1)][move.to.column] = "";

                sfx = "capture";
            } else if (move.to.row % 7 == 0) {
                board[move.to.row][move.to.column] = piece[0] + "q";

                sfx = "promote";
            }

            en_passant.row = null;
            en_passant.column = null;
        }
    } else {
        en_passant.row = null;
        en_passant.column = null;

        if (piece[1] == "k") {
            if (Math.abs(move.to.column - move.from.column) == 2) {
                board[move.to.row][move.to.column - (move.to.column - move.from.column) / 2] = piece[0] + "r";
                board[move.to.row][(move.to.column - move.from.column) > 0 ? 7 : 0] = "";

                sfx = "castle";
            }

            castling[piece[0]].kr = false;
            castling[piece[0]].qr = false;
        } else if (move.from.row == (piece[0] == "w" ? 7 : 0)) {
            if (move.from.column == 0) {
                castling[piece[0]].qr = false;
            } else if (move.from.column == 7) {
                castling[piece[0]].kr = false;
            }
        }
    }

    if (move.to.row == (piece[0] == "w" ? 0 : 7)) {
        if (move.to.column == 0) {
            castling[piece[0] == "w" ? "b" : "w"].qr = false;
        } else if (move.to.column == 7) {
            castling[piece[0] == "w" ? "b" : "w"].kr = false;
        }
    }

    if (update_turn) turn = turn == "w" ? "b" : "w";

    moves_stack.push(String.fromCharCode(97 + move.from.column) + (8 - move.from.row) + String.fromCharCode(97 + move.to.column) + (8 - move.to.row) + (sfx == "promote" ? "q" : ""));

    board_states.push(get_board_state());
}

function undo_move() {
    const undo = undo_stack.pop();

    board[undo.move.from.row][undo.move.from.column] = undo.moved_piece;
    board[undo.move.to.row][undo.move.to.column] = undo.captured_piece;

    if (undo.moved_piece[1] == "p") {
        if (undo.en_passant.row == undo.move.to.row && undo.en_passant.column == undo.move.to.column) board[undo.move.to.row + (undo.moved_piece[0] == "w" ? 1 : -1)][undo.move.to.column] = (undo.moved_piece[0] == "w" ? "b" : "w") + "p";
    } else if (undo.moved_piece[1] == "k" && Math.abs(undo.move.to.column - undo.move.from.column) == 2) {
        board[undo.move.to.row][undo.move.to.column - (undo.move.to.column - undo.move.from.column) / 2] = "";
        board[undo.move.to.row][(undo.move.to.column - undo.move.from.column) > 0 ? 7 : 0] = undo.moved_piece[0] + "r";
    }

    fifty_move_counter = undo.fifty_move_counter;
    en_passant = undo.en_passant;
    castling = undo.castling;
    turn = undo.turn;
    sfx = undo.sfx;

    moves_stack.pop();

    board_states.pop();
}

function get_board_state() {
    let en_passant_value = "00";

    if (en_passant.row && en_passant.column) {
        const next_row = en_passant.row + (turn == "w" ? 1 : -1);

        for (const side_column of [en_passant.column - 1, en_passant.column + 1]) {
            if (in_bounds(next_row, side_column)) {
                if (board[next_row][side_column] == turn + "p") {
                    en_passant_value = `${en_passant.row}${en_passant.column}`;
                    break;
                }
            }
        }
    }

    let board_state = turn + en_passant_value + (castling.w.kr ? 1 : 0) + (castling.w.qr ? 1 : 0) + (castling.b.kr ? 1 : 0) + (castling.b.qr ? 1 : 0);

    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column]) {
                board_state += board[row][column][0] == "w" ? board[row][column][1].toUpperCase() : board[row][column][1];
            } else {
                board_state += ".";
            }
        }
    }

    return board_state;
}

function get_special_draw() {
    if (fifty_move_counter == 100) return "50 Move Rule";

    const current_board_state = get_board_state();
    let occurrences = 0

    for (const board_state of board_states) {
        if (board_state == current_board_state) occurrences++;
    }

    if (occurrences == 3) return "Threefold Repetition";

    let knight = "";
    let bishops = "";
    let bishop_square_color = "";
    let index = 0;

    for (const square of current_board_state.slice(7)) {
        const piece = square.toLowerCase();

        if (piece == "p" || piece == "r" || piece == "q") {
            return "";
        } else if (piece == "n") {
            if (knight) return "";

            knight = square;
        } else if (piece == "b") {
            const square_color = (Math.floor(index / 8) + (index % 8)) % 2 == 0 ? "w" : "b";

            if (bishops.includes(square) || (bishop_square_color && (square_color != bishop_square_color))) return "";

            bishops += square;
            bishop_square_color = square_color;
        }

        index++;
    }

    return knight && bishops ? "" : "Insufficient Material";
}

function is_possible_moves() {
    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column][0] == turn) {
                if (get_possible_moves(row, column).length) return true;
            }
        }
    }

    return false;
}

function get_possible_moves(row, column) {
    const pieces_functions_map = { p: get_pawn_moves, n: get_knight_moves, b: get_bishop_moves, r: get_rook_moves, q: get_queen_moves, k: get_king_moves };
    const moves = pieces_functions_map[board[row][column][1]](row, column);
    const possible_moves = [];

    for (const move of moves) {
        apply_move({
            from: { row, column },
            to: move
        }, update_turn=false);

        if (!in_check()) possible_moves.push(move);

        undo_move();
    }

    return possible_moves;
}

function is_attacked(row, column) {
    const pieces_functions_map = { p: get_pawn_moves, n: get_knight_moves, b: get_bishop_moves, r: get_rook_moves, q: get_queen_moves, k: get_king_moves };

    for (const piece of Object.keys(pieces_functions_map)) {
        for (const move of pieces_functions_map[piece](row, column, include_casting=false)) {
            if (board[move.row][move.column][1] == piece) return true;
        }
    }

    return false;
}

function in_check() {
    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column] == turn + "k") {
                return is_attacked(row, column);
            }
        }
    }
}

function in_bounds(row, column) {
    return -1 < row && row < 8 && -1 < column && column < 8;
}

function get_offset_moves(row, column, offsets) {
    const moves = [];
    const piece_color = board[row][column][0];

    for (const [v_offset, h_offset] of offsets) {
        const offset_row = row + v_offset;
        const offset_column = column + h_offset;

        if (in_bounds(offset_row, offset_column) && board[offset_row][offset_column][0] != piece_color) moves.push({ row: offset_row, column: offset_column });
    }

    return moves;
}

function get_sliding_moves(row, column, directions) {
    const moves = [];
    const piece_color = board[row][column][0];

    for (const [v_direction, h_direction] of directions) {
        let direction_row = row + v_direction;
        let direction_column = column + h_direction;

        while (in_bounds(direction_row, direction_column)) {
            if (board[direction_row][direction_column][0] == piece_color) break;

            moves.push({ row: direction_row, column: direction_column });

            if (board[direction_row][direction_column]) break;

            direction_row += v_direction;
            direction_column += h_direction;
        }
    }

    return moves;
}

function get_pawn_moves(row, column) {
    const moves = [];
    const piece_color = board[row][column][0];
    const v_direction = piece_color == "w" ? -1 : 1;
    const first_row = piece_color == "w" ? 6 : 1;
    const next_row = row + v_direction;

    if (in_bounds(next_row, column) && !board[next_row][column]) {
        moves.push({ row: next_row, column });
        if (row == first_row && !board[row + v_direction * 2][column]) moves.push({ row: row + v_direction * 2, column });
    }

    for (const side_column of [column - 1, column + 1]) {
        if (in_bounds(next_row, side_column)) {
            if ((board[next_row][side_column] && board[next_row][side_column][0] != piece_color) || (en_passant.row == next_row && en_passant.column == side_column)) moves.push({ row: next_row, column: side_column });
        }
    }

    return moves;
}

function get_knight_moves(row, column) {
    return get_offset_moves(row, column, [[-2, -1], [-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2]]);
}

function get_bishop_moves(row, column) {
    return get_sliding_moves(row, column, [[-1, -1], [-1, 1], [1, 1], [1, -1]]);
}

function get_rook_moves(row, column) {
    return get_sliding_moves(row, column, [[-1, 0], [0, 1], [1, 0], [0, -1]]);
}

function get_queen_moves(row, column) {
    return get_sliding_moves(row, column, [[-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1]]);
}

function validate_castling_square(row, column, color) {
    if (board[row][column]) return false;

    board[row][column] = color;
    let is_valid = !is_attacked(row, column);
    board[row][column] = "";

    return is_valid;
}

function get_king_moves(row, column, include_casting=true) {
    const moves = get_offset_moves(row, column, [[-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1]]);
    const piece_color = board[row][column][0];

    if (include_casting && !is_attacked(row, column)) {
        if (castling[piece_color].kr && validate_castling_square(row, 5, piece_color) && validate_castling_square(row, 6, piece_color)) moves.push({ row, column: 6 });
        if (castling[piece_color].qr && validate_castling_square(row, 1, piece_color) && validate_castling_square(row, 2, piece_color) && validate_castling_square(row, 3, piece_color)) moves.push({ row, column: 2 });
    }

    return moves;
}

function evaluate_move(move) {
    const pieces_value_map = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let score = 0;

    const moved_piece = board[move.from.row][move.from.column];
    const captured_piece = (moved_piece[1] == "p" && en_passant.row == move.to.row && en_passant.column == move.to.column) ? "p" :  board[move.to.row][move.to.column][1];

    if (captured_piece) score += 10 * pieces_value_map[captured_piece] - pieces_value_map[moved_piece[1]];
    if (moved_piece[1] == "p" && move.to.row % 7 == 0) score += pieces_value_map.q;

    const next_row = move.to.row + (moved_piece[0] == "w" ? -1 : 1);

    for (const side_column of [move.to.column - 1, move.to.column + 1]) {
        if (in_bounds(next_row, side_column)) {
            if (board[next_row][side_column][0] != moved_piece[0] && board[next_row][side_column][1] == "p") {
                score -= pieces_value_map[moved_piece[1]];
                break;
            }
        }
    }

    return score;
}

function get_all_moves(first_move=null) {
    let index = 0;
    let first_move_index = 0;
    const moves = [];

    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column][0] == turn) {
                for (const move of get_possible_moves(row, column)) {
                    moves.push({
                        from: { row, column },
                        to: move
                    });

                    if (first_move && first_move.from.row == row && first_move.from.column == column && first_move.to.row == move.row && first_move.to.column == move.column) first_move_index = index;
                    index++;
                }
            }
        }
    }

    moves.sort((a, b) => evaluate_move(b) - evaluate_move(a));

    if (first_move) {
        moves.splice(first_move_index, 1);
        moves.unshift(first_move);
    }

    return moves;
}

function continue_minimax() {
    return (performance.now() - minimax_start_time) <= AI_difficulty * 200;
}

function get_book_move() {
    const moves = book_moves[get_board_state().slice(7)];

    if (moves) {
        let total_weight = 0;

        for (const move of moves) {
            total_weight += move.weight;
        }

        let random_weight = Math.random() * total_weight;

        for (const move of moves) {
            random_weight -= move.weight;

            if (random_weight <= 0) {
                return { from: move.from, to: move.to };
            }
        }
    }

    return null;
}

async function play_AI_move() {
    document.querySelector(".board").style.pointerEvents = "none";

    let best_move;

    if (AI_engine == "local") {
        best_move = moves_stack.length < 11 && get_book_move();

        if (!best_move) {
            minimax_start_time = performance.now();

            for (let depth = 1 ; continue_minimax() ; depth++) {
                let best_move_score = -Infinity;

                for (const move of get_all_moves(first_move=best_move)) {
                    apply_move(move);

                    let current_move;

                    if (get_special_draw()) {
                        current_move = { score: 0 };
                    } else {
                        const current_board_state = get_board_state();
                        const transposition = transposition_table[current_board_state];

                        if (transposition && transposition.depth >= depth - 1 && transposition.flag == "EXACT") {
                            current_move = { score: transposition.score };
                        } else {
                            const search_depth = in_check() ? depth : depth - 1;

                            current_move = minimax(search_depth, -Infinity, Infinity);
                            if (current_move.cache) transposition_table[current_board_state] = { score: current_move.score, depth: search_depth, flag: "EXACT" };
                        }
                    }

                    undo_move();

                    if (current_move.ignore) break;

                    if (current_move.score > best_move_score) {
                        best_move_score = current_move.score;
                        best_move = move;
                    }
                }
            }
        }
    } else {
        best_move = await new Promise((resolve) => {
            stockfish_engine.onmessage = (event) => {
                if (event.data.startsWith("bestmove")) {
                    const move = event.data.split(" ")[1];

                    resolve({
                        from: { row: 8 - move[1], column: move.charCodeAt(0) - 97 },
                        to: { row: 8 - move[3], column: move.charCodeAt(2) - 97 }
                    });
                }
            };

            stockfish_engine.postMessage(`position startpos moves ${moves_stack.join(" ")}`);
            stockfish_engine.postMessage(`go movetime ${AI_difficulty * 200}`);
        });
    }

    if (players != "watch") document.querySelector(".board").style.pointerEvents = "";

    apply_move(best_move);
    render_board(best_move);

    if (players == "watch") {
        if (winner) {
            player_color = player_color == "white" ? "black" : "white";
        } else {
            AI_engine = AI_engine == "local" ? "stockfish" : "local";

            setTimeout(() => play_AI_move(), 100);
        }
    }
}

function minimax(depth, alpha, beta) {
    if (!continue_minimax()) return { cache: false, ignore: true };

    const is_AI_turn = turn != player_color[0];

    if (!is_possible_moves()) {
        if (in_check()) {
            return { score: (is_AI_turn ? 1 : -1) * (-1000 - depth), cache: true };
        } else {
            return { score: 0, cache: true };
        }
    } else if (depth == 0) {
        return { score: quiescence(-Infinity, Infinity), cache: true };
    }

    const original_alpha = alpha;
    const original_beta = beta;
    let best_move = { score: is_AI_turn ? -Infinity : Infinity };

    for (const move of get_all_moves()) {
        apply_move(move);

        const special_draw = get_special_draw();
        let current_move;

        if (special_draw) {
            current_move = { score: 0, cache: special_draw == "Insufficient Material" };
        } else {
            const current_board_state = get_board_state();
            const transposition = transposition_table[current_board_state];

            if (transposition && transposition.depth >= depth - 1 && (transposition.flag == "EXACT" || (transposition.flag == "LOWER" && transposition.score >= original_beta) || (transposition.flag == "UPPER" && transposition.score <= original_alpha))) {
                current_move = { score: transposition.score, cache: true };
            } else {
                const search_depth = in_check() ? depth : depth - 1;

                current_move = minimax(search_depth, alpha, beta);

                if (current_move.cache) {
                    let flag = "EXACT";

                    if (current_move.score >= original_beta) {
                        flag = "LOWER";
                    } else if (current_move.score <= original_alpha) {
                        flag = "UPPER";
                    }

                    transposition_table[current_board_state] = { score: current_move.score, depth: search_depth, flag };
                }
            }
        }

        undo_move();

        if (current_move.ignore) return current_move;

        if (is_AI_turn) {
            if (current_move.score > best_move.score) best_move = current_move;
            if (current_move.score > alpha) alpha = current_move.score;
        } else {
            if (current_move.score < best_move.score) best_move = current_move;
            if (current_move.score < beta) beta = current_move.score;
        }

        if (beta <= alpha) return best_move;
    }

    return best_move;
}

function get_all_capture_moves() {
    const moves = [];

    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column][0] == turn) {
                for (const move of get_possible_moves(row, column)) {
                    if ((board[row][column][1] == "p" && en_passant.row == move.row && en_passant.column == move.column) || board[move.row][move.column]) {
                        moves.push({
                            from: { row, column },
                            to: move
                        });
                    }
                }
            }
        }
    }

    moves.sort((a, b) => evaluate_move(b) - evaluate_move(a));

    return moves;
}

function quiescence(alpha, beta) {
    const is_AI_turn = turn != player_color[0];
    const stand_pat = (is_AI_turn ? 1 : -1) * evaluate_board();

    if (is_AI_turn) {
        if (stand_pat >= beta) return beta;
        if (stand_pat > alpha) alpha = stand_pat;
    } else {
        if (stand_pat <= alpha) return alpha;
        if (stand_pat < beta) beta = stand_pat;
    }

    for (const move of get_all_capture_moves()) {
        apply_move(move);
        const score = quiescence(alpha, beta);
        undo_move();

        if (is_AI_turn) {
            if (score > alpha) alpha = score;
        } else {
            if (score < beta) beta = score;
        }

        if (beta <= alpha) break;
    }

    return is_AI_turn ? alpha : beta;
}

function evaluate_board() {
    const pieces_heat_map = {
        earlygame: {
            p: [
                [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
                [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
                [0.1, 0.1, 0.2, 0.3, 0.3, 0.2, 0.1, 0.1],
                [0.05, 0.05, 0.1, 0.25, 0.25, 0.1, 0.05, 0.05],
                [0.0, 0.0, 0.0, 0.2, 0.2, 0.0, 0.0, 0.0],
                [0.05, -0.05, -0.1, 0.0, 0.0, -0.1, -0.05, 0.05],
                [0.05, 0.1, 0.1, -0.2, -0.2, 0.1, 0.1, 0.05],
                [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
            ], n: [
                [-0.5, -0.4, -0.3, -0.3, -0.3, -0.3, -0.4, -0.5],
                [-0.4, -0.2, 0.0, 0.0, 0.0, 0.0, -0.2, -0.4],
                [-0.3, 0.0, 0.1, 0.15, 0.15, 0.1, 0.0, -0.3],
                [-0.3, 0.05, 0.15, 0.2, 0.2, 0.15, 0.05, -0.3],
                [-0.3, 0.0, 0.15, 0.2, 0.2, 0.15, 0.0, -0.3],
                [-0.3, 0.05, 0.1, 0.15, 0.15, 0.1, 0.05, -0.3],
                [-0.4, -0.2, 0.0, 0.05, 0.05, 0.0, -0.2, -0.4],
                [-0.5, -0.4, -0.3, -0.3, -0.3, -0.3, -0.4, -0.5]
            ], b: [
                [-0.2, -0.1, -0.1, -0.1, -0.1, -0.1, -0.1, -0.2],
                [-0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.1],
                [-0.1, 0.0, 0.05, 0.1, 0.1, 0.05, 0.0, -0.1],
                [-0.1, 0.05, 0.05, 0.1, 0.1, 0.05, 0.05, -0.1],
                [-0.1, 0.0, 0.1, 0.1, 0.1, 0.1, 0.0, -0.1],
                [-0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, -0.1],
                [-0.1, 0.05, 0.0, 0.0, 0.0, 0.0, 0.05, -0.1],
                [-0.2, -0.1, -0.1, -0.1, -0.1, -0.1, -0.1, -0.2]
            ], r: [
                [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
                [0.05, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05],
                [-0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05],
                [-0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05],
                [-0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05],
                [-0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05],
                [-0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05],
                [0.0, 0.0, 0.0, 0.05, 0.05, 0.0, 0.0, 0.0]
            ], q: [
                [-0.2, -0.1, -0.1, -0.05, -0.05, -0.1, -0.1, -0.2],
                [-0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.1],
                [-0.1, 0.0, 0.05, 0.05, 0.05, 0.05, 0.0, -0.1],
                [-0.05, 0.0, 0.05, 0.05, 0.05, 0.05, 0.0, -0.05],
                [0.0, 0.0, 0.05, 0.05, 0.05, 0.05, 0.0, -0.05],
                [-0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.0, -0.1],
                [-0.1, 0.0, 0.05, 0.0, 0.0, 0.0, 0.0, -0.1],
                [-0.2, -0.1, -0.1, -0.05, -0.05, -0.1, -0.1, -0.2]
            ], k: [
                [-0.3, -0.4, -0.4, -0.5, -0.5, -0.4, -0.4, -0.3],
                [-0.3, -0.4, -0.4, -0.5, -0.5, -0.4, -0.4, -0.3],
                [-0.3, -0.4, -0.4, -0.5, -0.5, -0.4, -0.4, -0.3],
                [-0.3, -0.4, -0.4, -0.5, -0.5, -0.4, -0.4, -0.3],
                [-0.2, -0.3, -0.3, -0.4, -0.4, -0.3, -0.3, -0.2],
                [-0.1, -0.2, -0.2, -0.2, -0.2, -0.2, -0.2, -0.1],
                [0.2, 0.2, 0.0, 0.0, 0.0, 0.0, 0.2, 0.2],
                [0.2, 0.3, 1.0, 0.0, 0.0, 0.0, 1.0, 0.2]
            ]
        }, endgame: {
            p: [
                [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
                [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
                [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
                [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
                [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2],
                [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
                [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
            ], k: [
                [-0.5, -0.4, -0.3, -0.3, -0.3, -0.3, -0.4, -0.5],
                [-0.4, -0.2, -0.1, 0.0, 0.0, -0.1, -0.2, -0.4],
                [-0.3, -0.1, 0.1, 0.2, 0.2, 0.1, -0.1, -0.3],
                [-0.3, 0.0, 0.2, 0.4, 0.4, 0.2, 0.0, -0.3],
                [-0.3, 0.0, 0.2, 0.4, 0.4, 0.2, 0.0, -0.3],
                [-0.3, -0.1, 0.1, 0.2, 0.2, 0.1, -0.1, -0.3],
                [-0.4, -0.2, -0.1, 0.0, 0.0, -0.1, -0.2, -0.4],
                [-0.5, -0.4, -0.3, -0.3, -0.3, -0.3, -0.4, -0.5]
            ]
        }
    }

    const pieces_value_map = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

    let pieces = 0;

    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column]) pieces++;
        }
    }

    let score = 0;
    const kings_positions = {};

    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column]) {
                score += (board[row][column][0] == turn ? 1 : -1) * (pieces_value_map[board[row][column][1]] + (pieces / 32) * pieces_heat_map.earlygame[board[row][column][1]][board[row][column][0] == "w" ? row : 7 - row][column]);

                if (board[row][column][1] == "p") {
                    score += (board[row][column][0] == turn ? 1 : -1) * (1 - pieces / 32) * pieces_heat_map.endgame.p[board[row][column][0] == "w" ? row : 7 - row][column];
                } else if (board[row][column][1] == "k") {
                    score += (board[row][column][0] == turn ? 1 : -1) * (1 - pieces / 32) * pieces_heat_map.endgame.k[row][column];

                    kings_positions[board[row][column][0]] = { row, column };
                }
            }
        }
    }

    score += (score > 0 ? 1 : -1) * (1 - pieces / 32) * (12 - Math.sqrt((kings_positions.w.row - kings_positions.b.row) ** 2 + (kings_positions.w.column - kings_positions.b.column) ** 2));

    return score;
}

function get_fen_string() {
    let fen_string = "";

    for (let row = 0 ; row < 8 ; row++) {
        let spaces = 0;

        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column]) {
                if (spaces) fen_string += spaces;
                spaces = 0;

                fen_string += board[row][column][0] == "b" ? board[row][column][1] : board[row][column][1].toUpperCase();
            } else {
                spaces++;
            }
        }

        if (spaces) fen_string += spaces;

        if (row != 7) fen_string += "/";
    }

    fen_string += " " + turn + " " + (((castling.w.kr ? "K" : "") + (castling.w.qr ? "Q" : "") + (castling.b.kr ? "k" : "") + (castling.b.qr ? "q" : "")) || "-") + " " + (en_passant.row && en_passant.column ? String.fromCharCode(97 + en_passant.column) + (8 - en_passant.row) : "-") + " " + fifty_move_counter + " " + (1 + Math.floor(moves_stack.length / 2));

    return fen_string;
}