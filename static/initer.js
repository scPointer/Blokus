/**
 * Created by QAQ on 2017/3/11.
 */
var socket;
var round;
var ratiox,ratioy,bw,bh;
var bars;
var colorTheme;
var stepTime,fullTime;
var username;
var counting = false;
var robot;


function initSize() {
    var w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    var h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    if(bw !== undefined)
        ratiox = w / bw;
    if(bh !== undefined)
        ratioy = h / bh;
    bw = w,bh = h;
    cellSize = Math.floor(Math.min(w,h)/ 30);
    boardSize = cellSize * 20;
    //if(Math.min(w,h) < 600){
        {
        var boxsize = cellSize * 3;
        var fontsize = cellSize * 1.5;
        var paddingsize = (boxsize - fontsize) / 2;
        $(".side-bar i").css("font-size",fontsize+"px");
        $(".side-bar").css({width:boxsize+"px"});
        $(".side-bar a").css({width:boxsize+"px",height:boxsize+"px"});
        $(".tgl+.tgl-btn").css({"font-size":fontsize+"px",width:boxsize+"px",height:boxsize+"px"});
        $(".side-bar i").css({"padding-left":paddingsize+"px","padding-top":paddingsize+"px"});
        $('head').append("<style>.tgl-flip+.tgl-btn :after{font-size:"+fontsize+"px}</style>");
        $('head').append("<style>.tgl-flip+.tgl-btn :before{font-size:"+fontsize+"px}</style>");
    }
}
function initSocket(){
    socket = io.connect('http://' + document.domain + ':' + location.port);
    socket.on('connect',function() { });
    socket.on('disconnect',function (){
        socket.emit("history",{o:owner});
    });
    socket.on('history', function (board){
        hist = board.hist; 
        round = 0;
        for(var ind in hist){
            AddChess(hist[ind]);
        }
        roundTime = board.remain.map(Math.floor);
        curTime = Math.max(0,Math.floor(stepTime-board.cur));
        roundTime[round % 4] -= Math.max(0,board.cur-stepTime);

        refreshBoard();
        refreshChess();
        refreshCorner();
        refreshProbar();


        if(!counting){
            countDown();
            counting = true;
        }
    });
    socket.on('startGame',function (sta){
        $("#start").modal('show');
    });
    socket.on('move',function(Sta){
        roundTime = Sta.remain.map(Math.floor);
        AddChess(Sta);
        if(round < 84 && round % 4 == owner && robot){
            Sta = availableRound();
            if(Sta.sta != -1){
                AddChess(Sta);
            }
        }
    });
    socket.on('info',function (room) {
        username = new Array;
        for(var i = 0 ; i < 4 ; i ++){
            if((room.status >> i ) & 1){
                cornerState[i] = i;
            }
            else cornerState[i] = -1;
            username[i] = room.user[i];
        }
        refreshCorner();
        if(room.status === 15){
            socket.emit("history",{})
        }
    });
    socket.on("gameover",function () {
        var counter = [{x:89,id:0},
                       {x:89,id:1},
                       {x:89,id:2},
                       {x:89,id:3}];
        for(var ind in boardFace){
            if(inbod(boardFace[ind]))
                counter[boardFace[ind].o].x--;
        }
        counter.sort(function (a,b) {
            return a.x - b.x;
        });
        var rnk = 1;
        for(var ind in counter){
            $("#left_"+ind).text(counter[ind].x);
            $("#color_"+ind).text(username[counter[ind].id]);
            if(ind != 0 && counter[ind].x != counter[ind-1].x) 
                rnk = 1 + parseInt(ind);
            $("#rank_"+ind).text(rnk);
        }
        $("#status").modal('show');
    });
}
function init(x) {
    owner = x;
    robot = false;
    round = -1;
    stepTime = 5,fullTime = 240;
    curTime = stepTime;
    roundTime = [fullTime,fullTime,fullTime,fullTime];
    initColorTheme();
    initSize();
    clearFace();
    createChess();
    createCorner();
    createProbar();
    initBoard();
    initChess();
    initCorner();
    initProbar();
    refreshBoard();
    refreshChess();
    refreshProbar();
    initAction();
    initSocket();
    $(window).resize(function () {
        initSize();
        scaleChess();
        initBoard();
        initChess();
        initCorner();
        initProbar();
        refreshBoard();
        refreshChess();
        refreshCorner();
        refreshProbar();
    })
    socket.emit("info",{});
}
function initAction() {
    function getID(cx, cy) {
        for(var i = 0 ; i < 21 ; i ++){
            if (isHide[i] === true) continue;
            var offx = chessLocate[i].x;
            var offy = chessLocate[i].y;
            for (var j in chessShape[i]) {
                var poi = chessShape[i][j];
                if (inreg(0, cellSize, cx - offx - cellSize * poi.x)
                    && inreg(0, cellSize, cy - offy - cellSize * poi.y)){
                    centx = cx - offx,centy = cy - offy;
                    return i;
                }
            }
        }
        for(var i = 0 ; i < 21 ; i ++){
            if (isHide[i] === true) continue;
            var Max = function (l,r){ return xy(Math.max(l.x,r.x),Math.max(l.y,r.y)); }
            var Min = function (l,r){ return xy(Math.min(l.x,r.x),Math.min(l.y,r.y)); }
            var ma = chessShape[i].reduce(Max);
            var mi = chessShape[i].reduce(Min);
            if(ma.x - mi.x <= 1) ma.x ++,mi.x--;
            if(ma.y - mi.y <= 1) ma.y ++,mi.y--;
            var offx = chessLocate[i].x;
            var offy = chessLocate[i].y;
            if (inreg(mi.x,ma.x + 1, (cx - offx) / cellSize)
             && inreg(mi.y,ma.y + 1, (cy - offy) / cellSize)){
                centx = cx - offx,centy = cy - offy;
                return i;
             }
        }
        return -1;
    }

    var mouseDown = false;
    var select = -1;
    var clix, cliy // mouselocetion
        , chsx, chsy //chesslocation
        , pox, poy //mouse index in board
        , centx,centy;//select chess center
    function updSelect(x) {
        if (select != -1) $("#chs_" + select).css("opacity", initp);
        select = x;
        if (select != -1) $("#chs_" + select).css("opacity", highp);
    }
    function getPo() {
        chsx = $("#chs_" + select).position().left;
        chsy = $("#chs_" + select).position().top;
        pox = Math.floor(0.5 + (chsx - $("#board").position().left) / cellSize);
        poy = Math.floor(0.5 + (chsy - $("#board").position().top ) / cellSize);
    }
    function moveChess(e) {
        if (select === -1) return;
        chsx -= clix - e.clientX, chsy -= cliy - e.clientY;
        moveChessTo(chsx,chsy,select);
    }
    function flipChess(ind,cenx,ceny) {
        tcentx = chessLocate[ind].x + cenx;
        tcenty = chessLocate[ind].y + ceny;
        chsy = tcenty * 2 - cellSize * 5 - chsy;

        centy = 5 * cellSize - centy;
        moveChessTo(chsx,chsy,select);

        chessState[select] = flipChessShape(chessShape[select],chessState[select]);
        refreshChess(select);
        getPo();
        inMask(select, pox, poy);
    }
    function rotateChess(ind, cenx, ceny, clock) {
        tcentx = chessLocate[ind].x + cenx;
        tcenty = chessLocate[ind].y + ceny;
        var dx = tcentx - chsx, dy = tcenty - chsy;
        if(clock) chsx = tcentx - dy, chsy =  tcenty - (5 * cellSize - dx);
        else      chsx = tcentx - (5 * cellSize - dy), chsy =  tcenty - dx;

        if(clock) centx = cellSize *  5 - centx;
        else       centy = cellSize *  5 - centy;
        {
            var temp = centx;
            centx = centy;
            centy = temp;
        }
        moveChessTo(chsx,chsy,select);

        chessState[select] = rotateChessShape(chessShape[select],chessState[select],clock);

        refreshChess(select);
        getPo();
        inMask(select, pox, poy);
    }

    var extend = false;
    function shadeoff(event,id,poi){
        var pos = [xy(-1,-1),xy(0,-1),xy(1,-1)
                  ,xy(-1, 0)         ,xy(1,0)
                  ,xy(-1, 1),xy(0, 1),xy(1,1)];
        var mx = (event.pageX - poi.x) / cellSize;
        var my = (event.pageY - poi.y) / cellSize;
        var sta = -1;
        for(var ind = 0 ; ind < 8 ; ind ++){
            if(inreg(pos[ind].x * 5 ,pos[ind].x * 5 + 5,mx) 
            && inreg(pos[ind].y * 5 ,pos[ind].y * 5 + 5,my)){
                sta = ind;
            }
        }
        if(sta != -1){
            if(0 != ((sta - chessState[id]) & 1))
                flipChess(id,centx,centy);
            while(sta != chessState[id])
                rotateChess(id,centx,centy,true);
            refreshChess(id);
        }
        getE("shade").clearRect(0,0,cellSize * 15,cellSize * 15);
    }
    function shadeon(id,poi){
        $("#shade").css({
            left:poi.x - 5 * cellSize + "px",
            top:poi.y - 5 * cellSize + "px"
        });
        var e = getE("shade");
        e.fillStyle = colorTheme.shade;
        e.fillRect(0,0,cellSize * 15,cellSize * 15);
        var chs = sCS[id].map(upd(0,0));
        var sta = 0;
        var pos = [xy(-1,-1),xy(0,-1),xy(1,-1)
                  ,xy(-1, 0)         ,xy(1,0)
                  ,xy(-1, 1),xy(0, 1),xy(1,1)];
        for(var _sta= 0 ; _sta < 8 ;_sta ++){
            if(_sta == 4)
                sta = flipChessShape(chs,sta);
            sta = rotateChessShape(chs,sta);
            var tchs = chs.map(upd(pos[sta].x*5+5,pos[sta].y*5+5));
            for(var ind in tchs){
                drawCell(tchs[ind],colorTheme.player(owner),e);
            }
            for(var ind in tchs){
                drawFrame(tchs[ind],colorTheme.frameColor,e);
            }
        }
        e.strokeStyle = "#000000";
        e.lineWidth = 1;
        e.beginPath();
        for (var i = 0; i <= 3; i++) {
            e.moveTo(i * cellSize * 5, 0), e.lineTo(i * cellSize * 5, cellSize * 15);
            e.moveTo(0, i * cellSize * 5), e.lineTo(cellSize * 15, i * cellSize * 5);
        }
        e.closePath();
        e.stroke();
    }
    function down(e){
        moved = false;
        if(extend == true){
            shadeoff(e,select,chessLocate[select]);
        }
        else{
            mouseDown = true;
            clix = e.clientX, cliy = e.clientY;
            getE("mask").clearRect(0, 0, boardSize, boardSize);
            updSelect(getID(clix, cliy));
            if (select !== -1)
                getPo(), inMask(select, pox, poy);
        }
    }
    function up(){
        getE("mask").clearRect(0, 0, boardSize, boardSize);
        mouseDown = false;
        if (extend == false 
            && select != -1 
            && inBoard(chessShape[select], pox, poy) === "legal" 
            && round % 4 === owner){
            sta = {round:round,x:pox,y:poy,id:select,sta:chessState[select]};
            AddChess(sta);
        }
        else{
            if(extend == false && (moved == false || action >= 8 )&& select != -1){
                extend = true;
                shadeon(select,chessLocate[select]);
            }
            else{
                if(extend == true){
                    extend = false;
                }
            }
        }
    }
    var action = 0,moved = false;
    function move(e){
        if (mouseDown === true && select !== -1) {
            getPo();
            moveChess(e);
            moved = true;
            inMask(select, pox, poy);
            if(action > 0){
                action --;
                if(action < 8){
                    if(bw > bh){
                        moveChessTo(chessLocate[select].x - cellSize,chessLocate[select].y,select);
                    }
                    else{
                        moveChessTo(chessLocate[select].x,chessLocate[select].y - cellSize,select);
                    }
                }
            }
        }
        clix = e.clientX, cliy = e.clientY;
    }
    $("#playGround").on('mousedown',down);
    $("#playGround").on('touchstart',function (e){
        down(e.originalEvent.touches[0]);
        action = 15;
        return false;
    });
    $("#playGround").on('mousemove',move);
    $("#playGround").on('touchmove',function (e){
        e.preventDefault();
        move(e.originalEvent.touches[0]);
        return false;
    });
    $("#playGround").on('mouseup touchend',function (){
        up();
        action = 0;
        return false;
    });
    $(window).keydown(function (e) {
        if (select === -1) return;
        switch (e.keyCode) {
            case 87: //w
            case 83: //s
                flipChess(select, centx, centy);
                break;
            case 65: // a
                rotateChess(select, centx, centy, true);
                break;
            case 68: //d
                rotateChess(select, centx, centy, false);
                break;
            default:
                break;
        }
    });
}

function initColorTheme(theme) {
    if (theme === undefined) {
        colorTheme = {
            legal: "#6f645e",
            horn: "#d5d7d5",
            rim: "#875f5f",
            unlegal: "#e1d9c4",
            can: "#f5f9f8",
            frameColor : "#ffffff",
            shade : "#e6eae9",
            lineColor: "#e6eae9",
            player: function (o) {
                switch (o) {
                    case -1: return "#b7b7b7";
                    case 0: return "#ed1c24";
                    case 1: return "#23b14d";
                    case 2: return "#00a2e8";
                    case 3: return "#ffc90d";
                }
                return undefined;
            },
            corner: function (o) {
                switch (o) {
                    case -1: return "#e6eae9";
                    case 0: return "#cf1b24";
                    case 1: return "#239546";
                    case 2: return "#0091cf";
                    case 3: return "#ebb60d";
                }
                return undefined;
            }
        }
    }
    else {
        colorTheme = theme;
    }
}
var roundTime,curTime;
function countDown(){
    if(curTime != 0) curTime --;
    else{
        roundTime[round%4]--;
        roundTime[round%4] = Math.max(roundTime[round%4],0);
    }
    bars[round % 4](roundTime[round % 4],curTime);
    if(round < 84) setTimeout("countDown()",1000);
}