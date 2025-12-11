// backend/server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// 게임 상태
let players = {};
let round = 1;
let gameRunning = false;
let maxRounds = 10;

io.on("connection", (socket) => {
  console.log("player connected:", socket.id);

  // 플레이어 입장
  socket.on("join", (name) => {
    players[socket.id] = {
      id: socket.id,
      name,
      timeLeft: 300,  // 총 5분
      score: 0,
      isPressing: false,
    };
    io.emit("players", Object.values(players));
  });

  // 버튼 누르고 있는 중
  socket.on("press", () => {
    const p = players[socket.id];
    if (!gameRunning || !p) return;

    p.isPressing = true;
  });

  // 버튼에서 손 뗌
  socket.on("release", () => {
    const p = players[socket.id];
    if (!p) return;
    p.isPressing = false;
  });

  // 라운드 시작
  socket.on("startRound", () => {
    if (gameRunning) return;
    gameRunning = true;

    io.emit("roundStart", { round });

    // 0.01초 단위로 시간 감소
    const tick = setInterval(() => {
      let pressingCount = 0;

      Object.values(players).forEach((p) => {
        if (p.isPressing) {
          p.timeLeft -= 0.01;
          pressingCount++;
        }
      });

      // 모두 버튼에서 손 떼면 종료
      if (pressingCount === 0) {
        clearInterval(tick);
        gameRunning = false;

        // 점수 계산: 누른 시간 = 사용한 시간
        Object.values(players).forEach((p) => {
          const usedTime = 300 - p.timeLeft;
          p.score += usedTime;
        });

        round++;

        io.emit("roundEnd", {
          round,
          players: Object.values(players),
        });

        // 게임 종료
        if (round > maxRounds) {
          io.emit("gameEnd", {
            players: Object.values(players)
              .sort((a, b) => b.score - a.score)
          });
        }
      }

      io.emit("players", Object.values(players));
    }, 10);
  });

  // 플레이어 퇴장
  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", Object.values(players));
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
