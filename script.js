let players, AI_difficulty, gamemode, from_square, undo_stack, fifty_move_counter, en_passant, castling, board, turn, sfx, board_states;

reset_options();

function reset_options(custom_players=null) {
    document.querySelector(".homepage").style.display = "";
    document.querySelector(".game").style.display = "";

    players = custom_players ?? 2;
    AI_difficulty = 4;
    gamemode = "local";

    for (const selected_option of document.querySelectorAll(".selected-option")) {
        selected_option.classList.remove("selected-option");
    }

    document.getElementById(`${players}-players`).classList.add("selected-option");

    if (players == 1) {
        document.querySelector(".AI-difficulty-container").style.display = "";
        document.querySelector(".gamemode-container").style.display = "none";
    } else {
        document.querySelector(".AI-difficulty-container").style.display = "none";
        document.querySelector(".gamemode-container").style.display = "";
    }

    document.getElementById("AI-difficulty").value = AI_difficulty;
    document.getElementById("AI-difficulty-span").innerHTML = AI_difficulty;
    document.getElementById(`${gamemode}-play`).classList.add("selected-option");
}

function update_AI_difficulty() {
    AI_difficulty = parseInt(document.getElementById("AI-difficulty").value);
    document.getElementById("AI-difficulty-span").innerHTML = AI_difficulty;
}

function select_gamemode(selected_gamemode) {
    gamemode = selected_gamemode;
    document.querySelector(".gamemode-container .selected-option").classList.remove("selected-option");
    document.getElementById(`${gamemode}-play`).classList.add("selected-option");
}

function start_game() {
    document.querySelector(".homepage").style.display = "none";
    document.querySelector(".game").style.display = "flex";
    document.getElementById("undo-button").disabled = false;
    document.querySelector(`#b-player .captured-pieces`).innerHTML = "";
    document.querySelector(`#b-player .captured-score`).innerHTML = "";
    document.querySelector(".board").style.pointerEvents = "";
    document.querySelector(`#w-player .captured-pieces`).innerHTML = "";
    document.querySelector(`#w-player .captured-score`).innerHTML = "";
    document.querySelector(".popup").style.display = "";

    undo_stack = [];
    fifty_move_counter = 0;
    en_passant = { row: null, column: null };
    castling = {
        w: { kr: true, qr: true },
        b: { kr: true, qr: true }
    }
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

    let board_html = "";

    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            board_html += `<span class="${(row * 7 + column) % 2 == 0 ? "white" : "green"}-square" id="${row}${column}" onclick="click_square(this)" ondragstart="drag_start(this)" ondragover="drag_over(this, event)" ondragleave="drag_leave(this, event)" ondrop="drop(this)">${board[row][column] && `<img src="assets/pieces/${board[row][column]}.png" />`}</span>`;
        }
    }

    document.querySelector(".board").innerHTML = board_html;

    (new Audio("assets/sfx/game-start.webm")).play();
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

    if (board[Math.floor(square.id / 10)][square.id % 10][0] == turn) {
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

        if (players == 1) setTimeout(() => play_AI_move(), 100);
    } else {
        remove_overlays();

        (new Audio("assets/sfx/illegal.webm")).play();
    }
}

function show_popup(title, description) {
    document.getElementById("undo-button").disabled = true;
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

function play_AI_move() {
    document.querySelector(".board").style.pointerEvents = "none";

    let best_move;
    let best_move_score = -Infinity;

    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column][0] == turn) {
                for (const move of get_possible_moves(row, column)) {
                    const full_move = {
                        from: { row, column },
                        to: move
                    };

                    apply_move(full_move);
                    const score = minimax(AI_difficulty - 1, -Infinity, Infinity);
                    undo_move();

                    if (score > best_move_score) {
                        best_move_score = score;
                        best_move = full_move;
                    }
                }
            }
        }
    }

    if (best_move) {
        document.querySelector(".board").style.pointerEvents = "";

        apply_move(best_move);
        render_board(best_move);
    }
}

function evaluate_board() {
    const pieces_heat_map = {
        p : [
            [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
            [0.1, 0.1, 0.2, 0.3, 0.3, 0.2, 0.1, 0.1],
            [0.05, 0.05, 0.1, 0.25, 0.25, 0.1, 0.05, 0.05],
            [0.0, 0.0, 0.0, 0.2, 0.2, 0.0, 0.0, 0.0],
            [0.05, -0.05, -0.1, 0.0, 0.0, -0.1, -0.05, 0.05],
            [0.05, 0.1, 0.1, -0.2, -0.2, 0.1, 0.1, 0.05],
            [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        ], n : [
            [-0.5, -0.4, -0.3, -0.3, -0.3, -0.3, -0.4, -0.5],
            [-0.4, -0.2, 0.0, 0.0, 0.0, 0.0, -0.2, -0.4],
            [-0.3, 0.0, 0.1, 0.15, 0.15, 0.1, 0.0, -0.3],
            [-0.3, 0.05, 0.15, 0.2, 0.2, 0.15, 0.05, -0.3],
            [-0.3, 0.0, 0.15, 0.2, 0.2, 0.15, 0.0, -0.3],
            [-0.3, 0.05, 0.1, 0.15, 0.15, 0.1, 0.05, -0.3],
            [-0.4, -0.2, 0.0, 0.05, 0.05, 0.0, -0.2, -0.4],
            [-0.5, -0.4, -0.3, -0.3, -0.3, -0.3, -0.4, -0.5]
        ], b : [
            [-0.2, -0.1, -0.1, -0.1, -0.1, -0.1, -0.1, -0.2],
            [-0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.1],
            [-0.1, 0.0, 0.05, 0.1, 0.1, 0.05, 0.0, -0.1],
            [-0.1, 0.05, 0.05, 0.1, 0.1, 0.05, 0.05, -0.1],
            [-0.1, 0.0, 0.1, 0.1, 0.1, 0.1, 0.0, -0.1],
            [-0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, -0.1],
            [-0.1, 0.05, 0.0, 0.0, 0.0, 0.0, 0.05, -0.1],
            [-0.2, -0.1, -0.1, -0.1, -0.1, -0.1, -0.1, -0.2]
        ], r : [
            [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            [0.05, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05],
            [-0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05],
            [-0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05],
            [-0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05],
            [-0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05],
            [-0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05],
            [0.0, 0.0, 0.0, 0.05, 0.05, 0.0, 0.0, 0.0]
        ], q : [
            [-0.2, -0.1, -0.1, -0.05, -0.05, -0.1, -0.1, -0.2],
            [-0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.1],
            [-0.1, 0.0, 0.05, 0.05, 0.05, 0.05, 0.0, -0.1],
            [-0.05, 0.0, 0.05, 0.05, 0.05, 0.05, 0.0, -0.05],
            [0.0, 0.0, 0.05, 0.05, 0.05, 0.05, 0.0, -0.05],
            [-0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.0, -0.1],
            [-0.1, 0.0, 0.05, 0.0, 0.0, 0.0, 0.0, -0.1],
            [-0.2, -0.1, -0.1, -0.05, -0.05, -0.1, -0.1, -0.2]
        ], k : [
            [-0.3, -0.4, -0.4, -0.5, -0.5, -0.4, -0.4, -0.3],
            [-0.3, -0.4, -0.4, -0.5, -0.5, -0.4, -0.4, -0.3],
            [-0.3, -0.4, -0.4, -0.5, -0.5, -0.4, -0.4, -0.3],
            [-0.3, -0.4, -0.4, -0.5, -0.5, -0.4, -0.4, -0.3],
            [-0.2, -0.3, -0.3, -0.4, -0.4, -0.3, -0.3, -0.2],
            [-0.1, -0.2, -0.2, -0.2, -0.2, -0.2, -0.2, -0.1],
            [0.2, 0.2, 0.0, 0.0, 0.0, 0.0, 0.2, 0.2],
            [0.2, 0.3, 1.0, 0.0, 0.0, 0.0, 1.0, 0.2]
        ]
    };
    const pieces_value_map = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let score = 0;

    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column]) {
                score += (board[row][column][0] == turn ? 1 : -1) * (pieces_value_map[board[row][column][1]] + pieces_heat_map[board[row][column][1]][board[row][column][0] == "w" ? row : 7 - row][column]);
            }
        }
    }

    return score;
}

function minimax(depth, alpha, beta) {
    const is_AI_turn = (AI_difficulty - depth) % 2 == 0;

    if (get_special_draw()) {
        return -500 - depth;
    } else if (!is_possible_moves()) {
        if (in_check()) {
            return (is_AI_turn ? 1 : -1) * (-1000 - depth);
        } else {
            return -500 - depth;
        }
    } else if (depth == 0) {
        return (is_AI_turn ? 1 : -1) * evaluate_board();
    }

    let best_move_score = (is_AI_turn ? 1 : -1) * -Infinity;

    for (let row = 0 ; row < 8 ; row++) {
        for (let column = 0 ; column < 8 ; column++) {
            if (board[row][column][0] == turn) {
                for (const move of get_possible_moves(row, column)) {
                    apply_move({
                        from: { row, column },
                        to: move
                    });
                    const score = minimax(depth - 1, alpha, beta);
                    undo_move();

                    if (is_AI_turn) {
                        if (score > best_move_score) best_move_score = score;
                        if (score > alpha) alpha = score;
                    } else {
                        if (score < best_move_score) best_move_score = score;
                        if (score < beta) beta = score;
                    }

                    if (beta <= alpha) return best_move_score;
                }
            }
        }
    }

    return best_move_score;
}