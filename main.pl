:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_files)).
:- use_module(library(lists)).

:- dynamic game/4.

:- prolog_load_context(directory, WebDirectory),
   assertz(web_directory(WebDirectory)).

:- http_handler(root(api/new), new_game, []).
:- http_handler(root(api/move), make_move, []).
:- http_handler(root(.), serve_files, [prefix]).

start_server(Port) :-
    http_server(http_dispatch, [port(Port)]).

serve_files(Request) :-
    web_directory(Directory),
    http_reply_from_files(Directory, [indexes(['index.html'])], Request).

new_game(Request) :-
    read_json_dict(Request, Payload),
    (   get_dict(disks, Payload, DiskCount),
        integer(DiskCount),
        between(3, 8, DiskCount)
    ->  numlist(1, DiskCount, Disks),
        with_mutex(hanoi_games,
            ( flag(hanoi_game_id, Number, Number + 1),
              format(string(GameId), 'hanoi-~d', [Number]),
              assertz(game(GameId, DiskCount, [Disks, [], []], 0))
            )),
        reply_json_dict(_{ok:true, game_id:GameId, disks:DiskCount,
                          pegs:[Disks, [], []], moves:0, won:false})
    ;   reply_json_dict(_{ok:false, error:"Choose between 3 and 8 disks."})
    ).

make_move(Request) :-
    read_json_dict(Request, Payload),
    (   get_dict(game_id, Payload, GameId),
        string(GameId),
        get_dict(from, Payload, From),
        integer(From),
        get_dict(to, Payload, To),
        integer(To),
        between(0, 2, From),
        between(0, 2, To),
        From =\= To
    ->  with_mutex(hanoi_games, move_game(GameId, From, To, Result)),
        reply_json_dict(Result)
    ;   reply_json_dict(_{ok:false, error:"That move request is not valid."})
    ).

move_game(GameId, From, To, Result) :-
    (   retract(game(GameId, DiskCount, Pegs, Moves))
    ->  nth0(From, Pegs, Source),
        nth0(To, Pegs, Destination),
        (   Source = [Disk|Rest],
            (Destination = [] ; Destination = [Top|_], Disk < Top)
        ->  replace_nth0(From, Pegs, Rest, PegsWithoutDisk),
            replace_nth0(To, PegsWithoutDisk, [Disk|Destination], NewPegs),
            NewMoves is Moves + 1,
            assertz(game(GameId, DiskCount, NewPegs, NewMoves)),
            nth0(2, NewPegs, GoalPeg),
            length(GoalPeg, GoalLength),
            (GoalLength =:= DiskCount -> Won = true ; Won = false),
            Result = _{ok:true, game_id:GameId, disks:DiskCount,
                       pegs:NewPegs, moves:NewMoves, won:Won}
        ;   assertz(game(GameId, DiskCount, Pegs, Moves)),
            Result = _{ok:false, error:"Illegal move. A larger disk cannot sit on a smaller disk."}
        )
    ;   Result = _{ok:false, error:"This game has expired. Start a new game to continue."}
    ).

replace_nth0(0, [_|Tail], Value, [Value|Tail]) :-
    !.
replace_nth0(Index, [Head|Tail], Value, [Head|UpdatedTail]) :-
    Index > 0,
    NextIndex is Index - 1,
    replace_nth0(NextIndex, Tail, Value, UpdatedTail).

:- initialization(main, main).

main :-
    start_server(8080),
    format('Tower of Hanoi is running at http://localhost:8080/~n', []),
    thread_get_message(stop).
