let players, AI_difficulty, gamemode, time, player_color, timer, gameover, undo_stack, fifty_move_counter, en_passant, castling, board, turn, board_states, transposition_table, minimax_start_time, ws, sfx, from_square;

reset_options();

function reset_options() {
    document.querySelector(".homepage").style.display = "";
    document.querySelector(".game").style.display = "";

    update_players("people");
    update_AI_difficulty(10);
    update_gamemode("local");
    update_time("rapid");
    update_player_color("white");

    gameover = true;
}

function update_players(updated_players) {
    players = updated_players;

    document.querySelector("#players .selected-option")?.classList.remove("selected-option");
    document.getElementById(`play-${players}`).classList.add("selected-option");

    if (players == "AI") {
        document.getElementById("AI-difficulty").style.display = "";
        document.getElementById("gamemode").style.display = "none";
        document.getElementById("time").style.display = "none";
        document.getElementById("player-color").style.display = "";
    } else {
        document.getElementById("AI-difficulty").style.display = "none";
        document.getElementById("gamemode").style.display = "";
        document.getElementById("time").style.display = "";
        document.getElementById("player-color").style.display = gamemode == "local" ? "none" : "";
    }
}

function update_AI_difficulty(updated_AI_difficulty) {
    if (0 < updated_AI_difficulty && updated_AI_difficulty < 21) {
        AI_difficulty = updated_AI_difficulty;

        document.querySelector("#AI-difficulty img").src = `/assets/homepage-options/AI-difficulty/${AI_difficulty}.png`;
    }
}

function update_gamemode(updated_gamemode) {
    gamemode = updated_gamemode;

    document.querySelector("#gamemode .selected-option")?.classList.remove("selected-option");
    document.getElementById(`${gamemode}-play`).classList.add("selected-option");
    document.getElementById("player-color").style.display = gamemode == "local" ? "none" : "";
}

function update_time(updated_time) {
    time = updated_time;

    document.querySelector("#time .selected-option")?.classList.remove("selected-option");
    document.getElementById(`${time}-time`).classList.add("selected-option");
}

function update_player_color(updated_player_color) {
    player_color = updated_player_color;

    document.querySelector("#player-color .selected-option")?.classList.remove("selected-option");
    document.getElementById(`${player_color}-color`).classList.add("selected-option");
}

function start_game() {
    const time_map = { bullet: 1, blitz: 5, rapid: 10 };
    timer = { w: time_map[time] * 60, b: time_map[time] * 60 };

    document.querySelector(".homepage").style.display = "none";
    document.querySelector(".game").style.display = "flex";
    document.getElementById("undo-button").disabled = false;
    document.querySelector(`#b-player .captured-pieces`).innerHTML = "";
    document.querySelector(`#b-player .captured-score`).innerHTML = "";
    document.querySelector(`#b-player .timer`).style.backgroundColor = "";
    document.querySelector(`#b-player .timer`).style.opacity = 0.5;
    document.querySelector(`#b-player .timer img`).src = "assets/timer/white-clock.png";
    document.querySelector(`#b-player .timer img`).style.transform = "";
    document.querySelector(`#b-player .timer span`).innerHTML = format_time(timer.b);
    document.querySelector(`#b-player .timer span`).style.color = "";
    document.querySelector(".board").style.pointerEvents = "";
    document.querySelector(`#w-player .captured-pieces`).innerHTML = "";
    document.querySelector(`#w-player .captured-score`).innerHTML = "";
    document.querySelector(`#w-player .timer`).style.backgroundColor = "";
    document.querySelector(`#w-player .timer`).style.opacity = 1;
    document.querySelector(`#w-player .timer img`).src = "assets/timer/black-clock.png";
    document.querySelector(`#w-player .timer img`).style.transform = "";
    document.querySelector(`#w-player .timer span`).innerHTML = format_time(timer.w);
    document.querySelector(`#w-player .timer span`).style.color = "";
    document.querySelector(".popup").style.display = "";

    gameover = false;
    undo_stack = [];
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

    if (players == "people" && gamemode == "local") {
        player_color = "white";
    } else if (player_color == "random") {
        player_color = Math.random() < 0.5 ? "white" : "black";
    }

    document.querySelector(".game").style.flexDirection = player_color == "white" ? "column" : "column-reverse";
    const start = player_color == "white" ? 0 : 7;
    const end = player_color == "white" ? 8 : -1;
    const step = player_color == "white" ? 1 : -1;

    let board_html = "";

    for (let row = start ; row != end ; row += step) {
        for (let column = start ; column != end ; column += step) {
            board_html += `<span class="${(row * 7 + column) % 2 == 0 ? "white" : "green"}-square" id="${row}${column}" onclick="click_square(this)" ondragstart="drag_start(this)" ondragover="drag_over(this, event)" ondragleave="drag_leave(this, event)" ondrop="drop(this)">${board[row][column] && `<img src="assets/pieces/${board[row][column]}.png" />`}</span>`;
        }
    }

    document.querySelector(".board").innerHTML = board_html;

    if (players == "AI") {
        (new Audio("assets/sfx/game-start.webm")).play();

        document.querySelector("#b-player .timer").style.display = "none";
        document.querySelector("#w-player .timer").style.display = "none";

        if (player_color == "black") setTimeout(() => play_AI_move(), 100);
    } else {
        if (gamemode == "online") {
            if (!ws) ws = new WebSocket("ws://ws.oridaniel.com");

            ws.onmessage = function (event) {
                if (event.data) {
                    load_game_string(event.data);
                } else {
                    (new Audio("assets/sfx/game-start.webm")).play();
                }
            }
        } else {
            (new Audio("assets/sfx/game-start.webm")).play();
        }

        document.querySelector("#b-player .timer").style.display = "";
        document.querySelector("#w-player .timer").style.display = "";

        setTimeout(() => update_timer(), 1000);
    }
}

function get_game_string(move) {
    return JSON.stringify({
        timer,
        gameover,
        fifty_move_counter,
        en_passant,
        castling,
        board,
        turn,
        sfx,
        move
    });
}

function load_game_string(game_string) {
    const game = JSON.parse(game_string);

    timer = game.timer;
    gameover = game.gameover;
    fifty_move_counter = game.fifty_move_counter;
    en_passant = game.en_passant;
    castling = game.castling;
    board = game.board;
    turn = game.turn;
    sfx = game.sfx;

    document.querySelector(`#b-player .timer span`).innerHTML = format_time(timer.b);
    document.querySelector(`#w-player .timer span`).innerHTML = format_time(timer.w);

    render_board(game.move);
}

function format_time(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function update_timer() {
    if (!gameover) {
        if (timer[turn]) {
            timer[turn]--;

            if (timer[turn] < 11) {
                document.querySelector(`#${turn}-player .timer`).style.backgroundColor = "#af1e22";
                document.querySelector(`#${turn}-player .timer img`).src = "assets/timer/white-clock.png";
                document.querySelector(`#${turn}-player .timer span`).style.color = "white";

                if (timer[turn] == 10) (new Audio("assets/sfx/tenseconds.webm")).play();
            }

            document.querySelector(`#${turn}-player .timer img`).style.transform = `rotate(${(-timer[turn] % 4) * 90}deg)`;
            document.querySelector(`#${turn}-player .timer span`).innerHTML = format_time(timer[turn]);

            setTimeout(() => update_timer(), 1000);
        } else {
            show_popup(`${turn == "w" ? "Black" : "White"} Won!`, "Timeout");

            (new Audio("assets/sfx/game-end.webm")).play();
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

    const piece_color = board[Math.floor(square.id / 10)][square.id % 10][0];

    if (piece_color == turn && (gamemode == "online" ? piece_color == player_color[0] : true)) {
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

        if (!gameover && players == "AI") {
            setTimeout(() => play_AI_move(), 100);
        } else if (gamemode == "online") {
            ws.send(get_game_string(move));
        }
    } else {
        remove_overlays();

        (new Audio("assets/sfx/illegal.webm")).play();
    }
}

function show_popup(title, description) {
    gameover = true;

    document.getElementById("undo-button").disabled = true;
    document.querySelector(`#${turn}-player .timer`).style.backgroundColor = "";
    document.querySelector(`#${turn}-player .timer img`).src = `assets/timer/${turn == "w" ? "black" : "white"}-clock.png`;
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
                document.getElementById(`${row}${column}`).innerHTML = `<img src="assets/pieces/${board[row][column]}.png" />`;

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
            if (pieces[opponent_color][piece] > 0) captured_pieces_html += `<img src="assets/captured-pieces/${opponent_color}${piece}${pieces[opponent_color][piece]}.png" />`;
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
        document.querySelector(`#${turn}-player .timer img`).src = "assets/timer/white-clock.png";
        document.querySelector(`#${turn}-player .timer span`).style.color = "white";
    }

    if (turn == "w") {
        document.querySelector(`#b-player .timer`).style.backgroundColor = "";
        document.querySelector(`#b-player .timer`).style.opacity = 0.5;
        document.querySelector(`#b-player .timer img`).src = "assets/timer/white-clock.png";
        document.querySelector(`#b-player .timer span`).style.color = "";
    } else {
        document.querySelector(`#w-player .timer`).style.backgroundColor = "";
        document.querySelector(`#w-player .timer`).style.opacity = 0.5;
        document.querySelector(`#w-player .timer img`).src = "assets/timer/black-clock.png";
        document.querySelector(`#w-player .timer span`).style.color = "";
    }

    const special_draw = get_special_draw();

    if (special_draw) {
        show_popup("Draw!", special_draw);

        custom_sfx = "game-end";
    } else if (!is_possible_moves()) {
        if (in_check()) {
            show_popup("Checkmate!", `${turn == "w" ? "Black" : "White"} Won`);

            custom_sfx = "game-end";
        } else {
            show_popup("Draw!", "Stalemate");

            custom_sfx = "game-end";
        }
    } else if (in_check()) {
        custom_sfx = "move-check";
    }

    (new Audio(`assets/sfx/${custom_sfx ?? sfx}.webm`)).play();
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

    board_states.pop();
}

function get_board_state() {
    let en_passant_value = 0;

    if (en_passant.row && en_passant.column) {
        const next_row = en_passant.row + (turn == "w" ? 1 : -1);

        for (const side_column of [en_passant.column - 1, en_passant.column + 1]) {
            if (in_bounds(next_row, side_column)) {
                if (board[next_row][side_column] == turn + "p") {
                    en_passant_value = 1;
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

    for (const square of current_board_state.slice(6)) {
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

    const next_row = move.to.row + moved_piece[0] == "w" ? -1 : 1;

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
    const moves = [];

    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column][0] == turn) {
                for (const move of get_possible_moves(row, column)) {
                    moves.push({
                        from: { row, column },
                        to: move
                    });
                }
            }
        }
    }

    moves.sort((a, b) => evaluate_move(b) - evaluate_move(a));

    if (first_move) {
        moves.splice(moves.indexOf(first_move), 1);
        moves.unshift(first_move);
    }

    return moves;
}

function continue_minimax() {
    return (performance.now() - minimax_start_time) <= AI_difficulty * 200;
}

function play_AI_move() {
    document.querySelector(".board").style.pointerEvents = "none";

    minimax_start_time = performance.now();

    let best_move;
    let best_move_score = -Infinity;

    for (let depth = 1 ; continue_minimax() ; depth++) {
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
                    current_move = minimax(depth - 1, -Infinity, Infinity);
                    if (current_move.cache) transposition_table[current_board_state] = { score: current_move.score, depth: depth - 1, flag: "EXACT" };
                }
            }

            undo_move();

            if (current_move.ignore) {
                break;
            } else if (current_move.score > best_move_score) {
                best_move_score = current_move.score;
                best_move = move;
            }
        }
    }

    document.querySelector(".board").style.pointerEvents = "";

    apply_move(best_move);
    render_board(best_move);
}

function minimax(depth, alpha, beta) {
    const is_AI_turn = turn != player_color[0];

    if (!continue_minimax()) {
        return { ignore: true, cache: false };
    } else if (!is_possible_moves()) {
        if (in_check()) {
            return { score: (is_AI_turn ? 1 : -1) * (-1000 - depth), cache: true };
        } else {
            return { score: 0, cache: true };
        }
    } else if (depth == 0) {
        return { score: (is_AI_turn ? 1 : -1) * evaluate_board(), cache: true };
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

            if (transposition && transposition.depth >= depth - 1 && (transposition.flag == "EXACT" || (transposition.flag == "LOWER" && transposition.score >= beta) || (transposition.flag == "UPPER" && transposition.score <= alpha))) {
                current_move = { score: transposition.score, cache: true };
            } else {
                current_move = minimax(depth - 1, alpha, beta);

                if (current_move.cache) {
                    let flag = "EXACT";

                    if (current_move.score >= original_beta) {
                        flag = "LOWER";
                    } else if (current_move.score <= original_alpha) {
                        flag = "UPPER";
                    }

                    transposition_table[current_board_state] = { score: current_move.score, depth: depth - 1, flag };
                }
            }
        }

        undo_move();

        if (current_move.ignore) {
            return current_move;
        } else {
            if (is_AI_turn) {
                if (current_move.score > best_move.score) best_move = current_move;
                if (current_move.score > alpha) alpha = current_move.score;
            } else {
                if (current_move.score < best_move.score) best_move = current_move;
                if (current_move.score < beta) beta = current_move.score;
            }
    
            if (beta <= alpha) break;
        }
    }

    return best_move;
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