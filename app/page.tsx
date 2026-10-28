"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type PlayerId = 0 | 1;
type Mode = "ai" | "online";
type Screen = "menu" | "game" | "result";
type SkinId = "diamond" | "cat" | "crown" | "robot" | "ghost" | "fox";
type TileKind =
  | "start"
  | "property"
  | "event"
  | "poker"
  | "tax"
  | "inspect"
  | "rest";
type Phase = "waiting" | "roll" | "rolling" | "moving" | "decision" | "poker" | "settling" | "finished";

type OnlineSession = {
  code: string;
  token: string;
  playerId: PlayerId;
  status: "waiting" | "playing";
};

type RoomPayload = {
  code?: string;
  token?: string;
  playerId?: PlayerId;
  status?: "waiting" | "playing";
  version?: number;
  state?: GameState;
  error?: string;
};

type Tile = {
  id: number;
  name: string;
  short: string;
  kind: TileKind;
  icon: string;
  description: string;
  price?: number;
  rent?: number;
  accent?: string;
};

type Player = {
  id: PlayerId;
  name: string;
  color: "cyan" | "coral";
  coins: number;
  position: number;
  skipTurns: number;
  skin: SkinId;
};

type Holding = {
  owner: PlayerId | null;
  level: number;
};

type Decision = {
  kind: "buy" | "upgrade";
  tileId: number;
  cost: number;
};

type PokerRound = {
  initiator: PlayerId;
  responder: PlayerId;
  cards: [number, number];
  bet: number;
  stage: "bet" | "response" | "reveal";
  result: string;
  winner: PlayerId | null;
  folded: boolean;
};

type GameState = {
  mode: Mode;
  players: [Player, Player];
  holdings: Record<number, Holding>;
  current: PlayerId;
  round: number;
  phase: Phase;
  dice: [number, number];
  message: string;
  log: string[];
  decision: Decision | null;
  poker: PokerRound | null;
  winner: PlayerId | null;
  lastEvent: string;
  bonusTurn: PlayerId | null;
};

const MAX_ROUNDS = 24;
const STARTING_COINS = 1000;
const START_BONUS = 200;
const TAX_AMOUNT = 120;
const REST_BONUS = 50;
const START_LANDING_BONUS = 80;
const FOLD_COST = 30;
const POKER_BETS = [50, 100, 200] as const;
const DIE_GLYPHS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const DICE_ROLL_TICKS = 10;
const DICE_ROLL_INTERVAL = 90;
const MOVE_STEP_DELAY = 270;
const LANDING_DELAY = 360;

const MARKET_HEAT_STAGES = [
  { level: 1, minRound: 1, label: "잠복", multiplier: 1, note: "기본 통행료" },
  { level: 2, minRound: 7, label: "과열", multiplier: 1.25, note: "통행료 25% 상승" },
  { level: 3, minRound: 13, label: "폭주", multiplier: 1.5, note: "통행료 50% 상승" },
  { level: 4, minRound: 19, label: "붕괴 직전", multiplier: 2, note: "통행료 2배" },
] as const;

const TOKEN_SKINS: { id: SkinId; name: string; icon: string }[] = [
  { id: "diamond", name: "다이아", icon: "◆" },
  { id: "cat", name: "검은 고양이", icon: "🐈‍⬛" },
  { id: "crown", name: "왕관", icon: "♛" },
  { id: "robot", name: "로봇", icon: "🤖" },
  { id: "ghost", name: "유령", icon: "👻" },
  { id: "fox", name: "여우", icon: "🦊" },
];

const BOARD: Tile[] = [
  {
    id: 0,
    name: "개장 종",
    short: "출발",
    kind: "start",
    icon: "◆",
    description: "한 바퀴를 완주할 때마다 월급 $200를 받습니다.",
    accent: "#f0c870",
  },
  {
    id: 1,
    name: "9번 부두",
    short: "9번 부두",
    kind: "property",
    icon: "▥",
    description: "새벽 밀수선이 드나드는 부두.",
    price: 140,
    rent: 40,
    accent: "#5ee7df",
  },
  {
    id: 2,
    name: "비밀 장부",
    short: "암거래",
    kind: "event",
    icon: "?",
    description: "암거래 카드 한 장을 공개합니다.",
    accent: "#a88aff",
  },
  {
    id: 3,
    name: "팬텀 몰",
    short: "팬텀 몰",
    kind: "property",
    icon: "▦",
    description: "간판 없는 지하 상가.",
    price: 200,
    rent: 60,
    accent: "#5ee7df",
  },
  {
    id: 4,
    name: "블러프 룸",
    short: "포커",
    kind: "poker",
    icon: "♠",
    description: "숫자 카드 한 장으로 $50·$100·$200 승부를 엽니다.",
    accent: "#efc269",
  },
  {
    id: 5,
    name: "네온 골목",
    short: "네온 골목",
    kind: "property",
    icon: "▤",
    description: "밤마다 값이 오르는 상권.",
    price: 170,
    rent: 50,
    accent: "#5ee7df",
  },
  {
    id: 6,
    name: "세관 조사",
    short: "세관 조사",
    kind: "tax",
    icon: "$",
    description: "세관 조사 비용 $120를 냅니다.",
    accent: "#ff765f",
  },
  {
    id: 7,
    name: "크립토 아케이드",
    short: "아케이드",
    kind: "property",
    icon: "▧",
    description: "코인으로만 입장 가능한 오락실.",
    price: 230,
    rent: 70,
    accent: "#7e9cff",
  },
  {
    id: 8,
    name: "비밀 장부",
    short: "암거래",
    kind: "event",
    icon: "?",
    description: "암거래 카드 한 장을 공개합니다.",
    accent: "#a88aff",
  },
  {
    id: 9,
    name: "벨벳 카지노",
    short: "카지노",
    kind: "property",
    icon: "♦",
    description: "이 도시에서 가장 비싼 테이블.",
    price: 300,
    rent: 100,
    accent: "#7e9cff",
  },
  {
    id: 10,
    name: "검문소",
    short: "검문소",
    kind: "inspect",
    icon: "▣",
    description: "다음 차례를 한 번 쉽니다.",
    accent: "#ff765f",
  },
  {
    id: 11,
    name: "로터스 타워",
    short: "로터스",
    kind: "property",
    icon: "♜",
    description: "상층부 전체가 비밀 거래소.",
    price: 260,
    rent: 80,
    accent: "#7e9cff",
  },
  {
    id: 12,
    name: "무법 지대",
    short: "휴식",
    kind: "rest",
    icon: "◎",
    description: "안전하게 쉬며 휴식 보너스 $50를 받습니다.",
    accent: "#efc269",
  },
  {
    id: 13,
    name: "블랙 레일",
    short: "블랙 레일",
    kind: "property",
    icon: "▰",
    description: "도시 외곽을 잇는 화물 철도.",
    price: 190,
    rent: 60,
    accent: "#dc76ff",
  },
  {
    id: 14,
    name: "하이롤러",
    short: "포커",
    kind: "poker",
    icon: "♣",
    description: "큰 판일수록 거짓말이 잘 먹힙니다.",
    accent: "#efc269",
  },
  {
    id: 15,
    name: "크라운 플라자",
    short: "크라운",
    kind: "property",
    icon: "♛",
    description: "왕관을 쓴 자만 소유하는 광장.",
    price: 330,
    rent: 110,
    accent: "#dc76ff",
  },
  {
    id: 16,
    name: "비밀 장부",
    short: "암거래",
    kind: "event",
    icon: "?",
    description: "암거래 카드 한 장을 공개합니다.",
    accent: "#a88aff",
  },
  {
    id: 17,
    name: "고스트 마켓",
    short: "고스트",
    kind: "property",
    icon: "◇",
    description: "지도에 표시되지 않는 야시장.",
    price: 270,
    rent: 90,
    accent: "#dc76ff",
  },
  {
    id: 18,
    name: "자금 세탁",
    short: "수수료",
    kind: "tax",
    icon: "$",
    description: "자금 세탁 수수료 $120를 냅니다.",
    accent: "#ff765f",
  },
  {
    id: 19,
    name: "옵시디언 호텔",
    short: "호텔",
    kind: "property",
    icon: "♚",
    description: "검은 유리로 지어진 최고급 호텔.",
    price: 380,
    rent: 130,
    accent: "#ff6f83",
  },
  {
    id: 20,
    name: "올인 테이블",
    short: "포커",
    kind: "poker",
    icon: "♥",
    description: "폴드할지 끝까지 갈지 선택합니다.",
    accent: "#efc269",
  },
  {
    id: 21,
    name: "문 포트",
    short: "문 포트",
    kind: "property",
    icon: "◐",
    description: "밤에만 열리는 공중 항구.",
    price: 310,
    rent: 100,
    accent: "#ff6f83",
  },
  {
    id: 22,
    name: "비밀 장부",
    short: "암거래",
    kind: "event",
    icon: "?",
    description: "암거래 카드 한 장을 공개합니다.",
    accent: "#a88aff",
  },
  {
    id: 23,
    name: "레드 볼트",
    short: "레드 볼트",
    kind: "property",
    icon: "⬢",
    description: "현금이 잠드는 붉은 금고.",
    price: 240,
    rent: 80,
    accent: "#ff6f83",
  },
];

const PLAYER_META = [
  { label: "청록", className: "cyan" },
  { label: "산호", className: "coral" },
] as const;

function makeHoldings() {
  return Object.fromEntries(
    BOARD.filter((tile) => tile.kind === "property").map((tile) => [
      tile.id,
      { owner: null, level: 0 },
    ]),
  ) as Record<number, Holding>;
}

function makeGame(
  mode: Mode,
  names: [string, string] = ["플레이어 1", "플레이어 2"],
  skins: [SkinId, SkinId] = ["diamond", "crown"],
): GameState {
  return {
    mode,
    players: [
      {
        id: 0,
        name: names[0].trim() || "플레이어 1",
        color: "cyan",
        coins: STARTING_COINS,
        position: 0,
        skipTurns: 0,
        skin: skins[0],
      },
      {
        id: 1,
        name: mode === "online" ? "상대 입장 대기" : "검은 여우",
        color: "coral",
        coins: STARTING_COINS,
        position: 0,
        skipTurns: 0,
        skin: mode === "online" ? skins[1] : "fox",
      },
    ],
    holdings: makeHoldings(),
    current: 0,
    round: 1,
    phase: "roll",
    dice: [1, 1],
    message: "주사위를 굴려 첫 거래를 시작하세요.",
    log: ["블랙마켓 개장 · 양쪽 모두 $1,000 보유"],
    decision: null,
    poker: null,
    winner: null,
    lastEvent: "시장 개장",
    bonusTurn: null,
  };
}

function otherPlayer(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0;
}

function clonePlayers(players: [Player, Player]): [Player, Player] {
  return [{ ...players[0] }, { ...players[1] }];
}

function addLog(log: string[], entry: string) {
  return [entry, ...log].slice(0, 6);
}

function formatMoney(value: number) {
  return `$${Math.max(0, Math.round(value)).toLocaleString("en-US")}`;
}

function formatMultiplier(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "");
}

function getMarketHeat(round: number) {
  return [...MARKET_HEAT_STAGES]
    .reverse()
    .find((stage) => round >= stage.minRound) ?? MARKET_HEAT_STAGES[0];
}

function calculateRent(tile: Tile, level: number, round: number) {
  const rawRent = (tile.rent ?? 0) * Math.max(1, level) * getMarketHeat(round).multiplier;
  return Math.ceil(rawRent / 10) * 10;
}

function getSkin(skinId: SkinId) {
  return TOKEN_SKINS.find((skin) => skin.id === skinId) ?? TOKEN_SKINS[0];
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function propertyCount(state: GameState, player: PlayerId) {
  return Object.values(state.holdings).filter((holding) => holding.owner === player)
    .length;
}

function buildingLevels(state: GameState, player: PlayerId) {
  return Object.values(state.holdings)
    .filter((holding) => holding.owner === player)
    .reduce((total, holding) => total + holding.level, 0);
}

function netWorth(state: GameState, player: PlayerId) {
  let total = state.players[player].coins;
  for (const tile of BOARD) {
    const holding = state.holdings[tile.id];
    if (tile.kind !== "property" || holding?.owner !== player) continue;
    const upgradeCost = Math.ceil((tile.price ?? 0) * 0.55);
    total += (tile.price ?? 0) + Math.max(0, holding.level - 1) * upgradeCost;
  }
  return total;
}

function ledgerWinner(state: GameState): PlayerId {
  const worth = [netWorth(state, 0), netWorth(state, 1)] as const;
  if (worth[0] !== worth[1]) return worth[0] > worth[1] ? 0 : 1;
  if (state.players[0].coins !== state.players[1].coins) {
    return state.players[0].coins > state.players[1].coins ? 0 : 1;
  }
  const properties = [propertyCount(state, 0), propertyCount(state, 1)] as const;
  if (properties[0] !== properties[1]) return properties[0] > properties[1] ? 0 : 1;
  const levels = [buildingLevels(state, 0), buildingLevels(state, 1)] as const;
  if (levels[0] !== levels[1]) return levels[0] > levels[1] ? 0 : 1;
  return 0;
}

function transferCoins(
  state: GameState,
  from: PlayerId,
  to: PlayerId,
  amount: number,
  message: string,
) {
  const players = clonePlayers(state.players);
  const paid = Math.min(amount, players[from].coins);
  players[from].coins -= paid;
  players[to].coins += paid;
  const bankrupt = players[from].coins <= 0;
  return {
    ...state,
    players,
    winner: bankrupt ? to : state.winner,
    phase: bankrupt ? ("finished" as const) : state.phase,
    message: bankrupt
      ? `${players[from].name} 파산! ${players[to].name} 승리`
      : message,
    log: addLog(state.log, message),
  };
}

function drawEvent(state: GameState, playerId: PlayerId): GameState {
  const players = clonePlayers(state.players);
  const opponent = otherPlayer(playerId);
  const roll = Math.floor(Math.random() * 6);
  let title = "";
  let detail = "";

  if (roll === 0) {
    title = "위조 지폐 적발";
    players[playerId].coins = Math.max(0, players[playerId].coins - 120);
    detail = `${players[playerId].name} $120 손실`;
  } else if (roll === 1) {
    title = "새벽 밀거래 성공";
    players[playerId].coins += 160;
    detail = `${players[playerId].name} $160 획득`;
  } else if (roll === 2) {
    title = "상대 장부 탈취";
    const stolen = Math.min(100, players[opponent].coins);
    players[opponent].coins -= stolen;
    players[playerId].coins += stolen;
    detail = `${players[opponent].name}에게서 ${formatMoney(stolen)} 강탈`;
  } else if (roll === 3) {
    title = "비밀 투자자";
    const investment = 60 + propertyCount(state, playerId) * 40;
    players[playerId].coins += investment;
    detail = `보유 구역 보너스 ${formatMoney(investment)} 획득`;
  } else if (roll === 4) {
    title = "검문 회피 실패";
    players[playerId].skipTurns += 1;
    detail = `${players[playerId].name} 다음 차례 정지`;
  } else {
    title = "암시장 배당";
    players[0].coins += 80;
    players[1].coins += 80;
    detail = "모든 플레이어 $80 획득";
  }

  const bankruptPlayer = players.find((entry) => entry.coins <= 0);
  return {
    ...state,
    players,
    phase: bankruptPlayer ? "finished" : "settling",
    winner: bankruptPlayer ? otherPlayer(bankruptPlayer.id) : null,
    message: `${title} · ${detail}`,
    lastEvent: title.toUpperCase(),
    log: addLog(state.log, `${title} — ${detail}`),
  };
}

function landOnTile(state: GameState, playerId: PlayerId): GameState {
  const tile = BOARD[state.players[playerId].position];
  const player = state.players[playerId];
  const opponent = otherPlayer(playerId);

  if (tile.kind === "property") {
    const holding = state.holdings[tile.id];
    if (holding.owner === null) {
      return {
        ...state,
        phase: "decision",
        decision: { kind: "buy", tileId: tile.id, cost: tile.price ?? 0 },
        message: `${tile.name}이 비어 있습니다. ${formatMoney(tile.price ?? 0)}에 인수할까요?`,
        lastEvent: "새 구역 판매",
      };
    }
    if (holding.owner === playerId) {
      if (holding.level < 3) {
        const cost = Math.ceil((tile.price ?? 0) * 0.55);
        return {
          ...state,
          phase: "decision",
          decision: { kind: "upgrade", tileId: tile.id, cost },
          message: `${tile.name}을 ${holding.level + 1}단계로 확장할 수 있습니다.`,
          lastEvent: "건물 확장 기회",
        };
      }
      return {
        ...state,
        phase: "settling",
        message: `${tile.name}은 이미 최고 등급입니다.`,
        log: addLog(state.log, `${player.name} · 자기 구역 ${tile.name} 도착`),
        lastEvent: "내 구역 도착",
      };
    }

    const heat = getMarketHeat(state.round);
    const rent = calculateRent(tile, holding.level, state.round);
    return transferCoins(
      { ...state, phase: "settling" },
      playerId,
      holding.owner,
      rent,
      `${player.name} → ${state.players[holding.owner].name} 통행료 ${formatMoney(rent)} · 시장 ${formatMultiplier(heat.multiplier)}배`,
    );
  }

  if (tile.kind === "event") return drawEvent(state, playerId);

  if (tile.kind === "poker") {
    const cards: [number, number] = [
      2 + Math.floor(Math.random() * 13),
      2 + Math.floor(Math.random() * 13),
    ];
    const botStarts = state.mode === "ai" && playerId === 1;
    const bet = botStarts
      ? cards[1] >= 10
        ? 200
        : cards[1] >= 6
          ? 100
          : Math.random() > 0.55
            ? 200
            : 50
      : 50;
    return {
      ...state,
      phase: "poker",
      poker: {
        initiator: playerId,
        responder: opponent,
        cards,
        bet,
        stage: botStarts ? "response" : "bet",
        result: "",
        winner: null,
        folded: false,
      },
      message: `${player.name}이 블러프 승부를 열었습니다.`,
      lastEvent: "포커 승부",
      log: addLog(state.log, `${player.name} · 블러프 룸 입장`),
    };
  }

  if (tile.kind === "tax") {
    const players = clonePlayers(state.players);
    const tax = Math.min(TAX_AMOUNT, players[playerId].coins);
    players[playerId].coins -= tax;
    const bankrupt = players[playerId].coins <= 0;
    return {
      ...state,
      players,
      phase: bankrupt ? "finished" : "settling",
      winner: bankrupt ? opponent : null,
      message: `${tile.name} · ${player.name} ${formatMoney(tax)} 납부`,
      log: addLog(state.log, `${player.name} 세관 비용 ${formatMoney(tax)}`),
      lastEvent: "시장 비용 납부",
    };
  }

  if (tile.kind === "inspect") {
    const players = clonePlayers(state.players);
    players[playerId].skipTurns += 1;
    return {
      ...state,
      players,
      phase: "settling",
      message: `${player.name} 검문 적발 · 다음 차례를 쉽니다.`,
      log: addLog(state.log, `${player.name} 검문소에 억류`),
      lastEvent: "검문 적발",
    };
  }

  if (tile.kind === "rest") {
    const players = clonePlayers(state.players);
    players[playerId].coins += REST_BONUS;
    return {
      ...state,
      players,
      phase: "settling",
      message: `${player.name} 무법 지대에서 ${formatMoney(REST_BONUS)} 확보`,
      log: addLog(state.log, `${player.name} 안전 수익 ${formatMoney(REST_BONUS)}`),
      lastEvent: "휴식 보너스",
    };
  }

  return {
    ...state,
    phase: "settling",
    message: `${player.name} 개장 종 도착 · 보너스 ${formatMoney(START_LANDING_BONUS)}`,
    players: state.players.map((entry, index) =>
      index === playerId
        ? { ...entry, coins: entry.coins + START_LANDING_BONUS }
        : { ...entry },
    ) as [Player, Player],
    log: addLog(state.log, `${player.name} 출발 보너스 ${formatMoney(START_LANDING_BONUS)}`),
    lastEvent: "출발 보너스",
  };
}

function advanceTurn(state: GameState): GameState {
  if (state.phase === "finished") return state;
  if (state.bonusTurn === state.current) {
    return {
      ...state,
      phase: "roll",
      dice: [1, 1],
      decision: null,
      poker: null,
      bonusTurn: null,
      message: `${state.players[state.current].name} 더블 보너스 · 주사위를 한 번 더 굴리세요!`,
      lastEvent: "더블 추가 턴",
      log: addLog(state.log, `${state.players[state.current].name} · 더블로 추가 턴 획득`),
    };
  }
  const next = otherPlayer(state.current);
  const nextRound = state.current === 1 ? state.round + 1 : state.round;
  if (nextRound > MAX_ROUNDS) {
    const leftWorth = netWorth(state, 0);
    const rightWorth = netWorth(state, 1);
    const winner = ledgerWinner(state);
    return {
      ...state,
      phase: "finished",
      winner,
      message: `시장 폐장 · 순자산 ${formatMoney(Math.max(leftWorth, rightWorth))}로 승리`,
      lastEvent: "시장 폐장",
      bonusTurn: null,
    };
  }
  const previousHeat = getMarketHeat(state.round);
  const nextHeat = getMarketHeat(nextRound);
  const heatRaised = nextHeat.level > previousHeat.level;
  return {
    ...state,
    current: next,
    round: nextRound,
    phase: "roll",
    dice: [1, 1],
    decision: null,
    poker: null,
    bonusTurn: null,
    message: heatRaised
      ? `시장 ${nextHeat.label} 진입! 통행료 ${formatMultiplier(nextHeat.multiplier)}배 · ${state.players[next].name} 차례`
      : `${state.players[next].name} 차례 · 주사위를 굴리세요.`,
    lastEvent: heatRaised ? "시장 위험도 상승" : "다음 차례",
    log: heatRaised
      ? addLog(state.log, `⚠ ${nextRound}라운드 ${nextHeat.label} · ${nextHeat.note}`)
      : state.log,
  };
}

function boardPosition(index: number) {
  if (index <= 6) return { gridColumn: 7 - index, gridRow: 7 };
  if (index <= 12) return { gridColumn: 1, gridRow: 13 - index };
  if (index <= 18) return { gridColumn: index - 11, gridRow: 1 };
  return { gridColumn: 7, gridRow: index - 17 };
}

function cardLabel(value: number) {
  if (value === 14) return "A";
  if (value === 13) return "K";
  if (value === 12) return "Q";
  if (value === 11) return "J";
  return String(value);
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [game, setGame] = useState<GameState>(() => makeGame("ai"));
  const [showRules, setShowRules] = useState(false);
  const [showOnlineMenu, setShowOnlineMenu] = useState(false);
  const [nicknames, setNicknames] = useState<[string, string]>(["플레이어 1", "플레이어 2"]);
  const [selectedSkins, setSelectedSkins] = useState<[SkinId, SkinId]>(["diamond", "crown"]);
  const [viewedTileId, setViewedTileId] = useState<number | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [onlineSession, setOnlineSession] = useState<OnlineSession | null>(null);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [onlineError, setOnlineError] = useState("");
  const [onlineConnection, setOnlineConnection] = useState("연결됨");
  const [roomCodeCopied, setRoomCodeCopied] = useState(false);
  const gameRef = useRef(game);
  const motionRunRef = useRef(0);
  const onlineSessionRef = useRef<OnlineSession | null>(null);
  const onlineVersionRef = useRef(0);
  const applyingRemoteRef = useRef(false);
  const pendingOnlineStateRef = useRef<GameState | null>(null);
  const onlinePushActiveRef = useRef(false);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    onlineSessionRef.current = onlineSession;
  }, [onlineSession]);

  const installOnlineSession = (session: OnlineSession | null, version = 0) => {
    onlineSessionRef.current = session;
    onlineVersionRef.current = version;
    pendingOnlineStateRef.current = null;
    setOnlineSession(session);
  };

  const flushOnlineState = useCallback(async () => {
    if (onlinePushActiveRef.current) return;
    onlinePushActiveRef.current = true;

    while (pendingOnlineStateRef.current) {
      const state = pendingOnlineStateRef.current;
      pendingOnlineStateRef.current = null;
      const session = onlineSessionRef.current;
      if (!session) break;

      try {
        setOnlineConnection("동기화 중");
        const response = await fetch(`/api/rooms/${session.code}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-player-token": session.token,
          },
          body: JSON.stringify({
            expectedVersion: onlineVersionRef.current,
            state,
          }),
        });
        const payload = (await response.json()) as RoomPayload;
        if (response.ok && typeof payload.version === "number") {
          onlineVersionRef.current = payload.version;
          setOnlineConnection("연결됨");
          continue;
        }
        if (response.status === 409 && payload.state && typeof payload.version === "number") {
          onlineVersionRef.current = payload.version;
          pendingOnlineStateRef.current = null;
          applyingRemoteRef.current = true;
          gameRef.current = payload.state;
          setGame(payload.state);
          setOnlineConnection("연결됨");
          continue;
        }
        throw new Error(payload.error || "동기화 실패");
      } catch {
        if (!onlineSessionRef.current) break;
        pendingOnlineStateRef.current ??= state;
        setOnlineConnection("재연결 중");
        await wait(800);
      }
    }

    onlinePushActiveRef.current = false;
  }, []);

  const startGame = (mode: Mode) => {
    motionRunRef.current += 1;
    installOnlineSession(null);
    const fresh = makeGame(mode, nicknames, selectedSkins);
    gameRef.current = fresh;
    setGame(fresh);
    setViewedTileId(null);
    setScreen("game");
  };

  const returnToMenu = () => {
    motionRunRef.current += 1;
    installOnlineSession(null);
    setShowOnlineMenu(false);
    setOnlineError("");
    setScreen("menu");
  };

  const createOnlineRoom = async () => {
    setOnlineBusy(true);
    setOnlineError("");
    const fresh: GameState = {
      ...makeGame("online", nicknames, selectedSkins),
      phase: "waiting",
      message: "상대가 방 코드로 들어오기를 기다리고 있습니다.",
      lastEvent: "온라인 상대 대기 중",
    };
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: nicknames[0],
          skin: selectedSkins[0],
          state: fresh,
        }),
      });
      const payload = (await response.json()) as RoomPayload;
      if (
        !response.ok ||
        !payload.code ||
        !payload.token ||
        payload.playerId !== 0 ||
        !payload.status ||
        typeof payload.version !== "number" ||
        !payload.state
      ) {
        throw new Error(payload.error || "온라인 방을 만들지 못했습니다.");
      }
      const session: OnlineSession = {
        code: payload.code,
        token: payload.token,
        playerId: 0,
        status: payload.status,
      };
      installOnlineSession(session, payload.version);
      gameRef.current = payload.state;
      setGame(payload.state);
      setViewedTileId(null);
      setRoomCodeCopied(false);
      setShowOnlineMenu(false);
      setScreen("game");
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : "온라인 방을 만들지 못했습니다.");
    } finally {
      setOnlineBusy(false);
    }
  };

  const joinOnlineRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setOnlineError("방 코드 6자리를 입력해 주세요.");
      return;
    }
    setOnlineBusy(true);
    setOnlineError("");
    try {
      const response = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nicknames[0], skin: selectedSkins[0] }),
      });
      const payload = (await response.json()) as RoomPayload;
      if (
        !response.ok ||
        !payload.code ||
        !payload.token ||
        payload.playerId !== 1 ||
        !payload.status ||
        typeof payload.version !== "number" ||
        !payload.state
      ) {
        throw new Error(payload.error || "온라인 방에 들어가지 못했습니다.");
      }
      const session: OnlineSession = {
        code: payload.code,
        token: payload.token,
        playerId: 1,
        status: payload.status,
      };
      applyingRemoteRef.current = true;
      installOnlineSession(session, payload.version);
      gameRef.current = payload.state;
      setGame(payload.state);
      setViewedTileId(null);
      setShowOnlineMenu(false);
      setScreen("game");
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : "온라인 방에 들어가지 못했습니다.");
    } finally {
      setOnlineBusy(false);
    }
  };

  const copyRoomCode = async () => {
    if (!onlineSession) return;
    await navigator.clipboard.writeText(onlineSession.code);
    setRoomCodeCopied(true);
    window.setTimeout(() => setRoomCodeCopied(false), 1400);
  };

  useEffect(() => {
    if (screen !== "game" || game.mode !== "online" || !onlineSessionRef.current) return;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }
    if (game.phase === "waiting") return;
    pendingOnlineStateRef.current = game;
    const timer = window.setTimeout(() => void flushOnlineState(), 0);
    return () => window.clearTimeout(timer);
  }, [flushOnlineState, game, screen]);

  useEffect(() => {
    if (!onlineSession || screen !== "game") return;
    let cancelled = false;
    let timer = 0;

    const pollRoom = async () => {
      const session = onlineSessionRef.current;
      if (!session || cancelled) return;
      if (!onlinePushActiveRef.current && !pendingOnlineStateRef.current) {
        try {
          const response = await fetch(`/api/rooms/${session.code}`, {
            headers: { "x-player-token": session.token },
            cache: "no-store",
          });
          const payload = (await response.json()) as RoomPayload;
          if (!response.ok) throw new Error(payload.error || "방 연결 실패");
          if (payload.status && payload.status !== session.status) {
            const nextSession = { ...session, status: payload.status };
            onlineSessionRef.current = nextSession;
            setOnlineSession(nextSession);
          }
          if (
            payload.state &&
            typeof payload.version === "number" &&
            payload.version > onlineVersionRef.current
          ) {
            onlineVersionRef.current = payload.version;
            applyingRemoteRef.current = true;
            gameRef.current = payload.state;
            setViewedTileId(null);
            setGame(payload.state);
          }
          setOnlineConnection("연결됨");
        } catch {
          setOnlineConnection("재연결 중");
        }
      }
      timer = window.setTimeout(pollRoom, 380);
    };

    void pollRoom();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [onlineSession, screen]);

  const performRoll = useCallback(() => {
    const current = gameRef.current;
    if (current.phase !== "roll" || current.winner !== null) return;
    const playerId = current.current;
    if (
      current.mode === "online" &&
      onlineSessionRef.current?.playerId !== playerId
    ) return;
    const first = Math.ceil(Math.random() * 6);
    const second = Math.ceil(Math.random() * 6);
    const isDouble = first === second;
    const steps = first + second;
    const runId = ++motionRunRef.current;
    setViewedTileId(null);
    setGame({
      ...current,
      phase: "rolling",
      message: `${current.players[playerId].name} · 주사위를 굴리는 중…`,
      lastEvent: "주사위 굴리는 중",
    });

    const animateRollAndMove = async () => {
      for (let tick = 0; tick < DICE_ROLL_TICKS; tick += 1) {
        await wait(DICE_ROLL_INTERVAL);
        if (motionRunRef.current !== runId) return;
        setGame((latest) =>
          latest.phase === "rolling" && latest.current === playerId
            ? {
                ...latest,
                dice: [Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)],
              }
            : latest,
        );
      }

      if (motionRunRef.current !== runId) return;
      setGame((latest) =>
        latest.phase === "rolling" && latest.current === playerId
          ? {
              ...latest,
              phase: "moving",
              dice: [first, second],
              bonusTurn: isDouble ? playerId : null,
              message: isDouble
                ? `더블 ${first}! ${steps}칸 이동 후 한 번 더 굴립니다.`
                : `${latest.players[playerId].name} · ${steps}칸 이동 시작`,
              lastEvent: isDouble ? "더블 · 추가 턴 예약" : "말 이동 중",
              log: isDouble
                ? addLog(latest.log, `⚡ ${latest.players[playerId].name} 더블 ${first} · 추가 턴 예약`)
                : latest.log,
            }
          : latest,
      );

      for (let step = 1; step <= steps; step += 1) {
        await wait(MOVE_STEP_DELAY);
        if (motionRunRef.current !== runId) return;
        setGame((latest) => {
          if (latest.phase !== "moving" || latest.current !== playerId) return latest;
          const players = clonePlayers(latest.players);
          const oldPosition = players[playerId].position;
          const nextPosition = (oldPosition + 1) % BOARD.length;
          const passedStart = nextPosition === 0;
          players[playerId].position = nextPosition;
          if (passedStart) players[playerId].coins += START_BONUS;
          return {
            ...latest,
            players,
            message: `${players[playerId].name} · ${step}/${steps}칸 이동 중`,
            lastEvent: "말 이동 중",
            log: passedStart
              ? addLog(
                  latest.log,
                  `${players[playerId].name} 한 바퀴 완주 · ${formatMoney(START_BONUS)}`,
                )
              : latest.log,
          };
        });
      }

      await wait(LANDING_DELAY);
      if (motionRunRef.current !== runId) return;
      setGame((latest) => {
        if (latest.phase !== "moving" || latest.current !== playerId) return latest;
        const tile = BOARD[latest.players[playerId].position];
        return landOnTile(
          {
            ...latest,
            message: `${latest.players[playerId].name} · ${tile.name} 도착`,
            lastEvent: "칸 도착",
          },
          playerId,
        );
      });
    };

    void animateRollAndMove();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen !== "game" || event.code !== "Space" || event.repeat) return;
      event.preventDefault();
      performRoll();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [performRoll, screen]);

  const resolveDecision = useCallback((accept: boolean) => {
    const current = gameRef.current;
    const decision = current.decision;
    if (current.phase !== "decision" || !decision) return;
    const tile = BOARD[decision.tileId];
    const playerId = current.current;
    if (
      current.mode === "online" &&
      onlineSessionRef.current?.playerId !== playerId
    ) return;
    const players = clonePlayers(current.players);
    const holdings = { ...current.holdings };

    if (accept && players[playerId].coins >= decision.cost) {
      players[playerId].coins -= decision.cost;
      if (decision.kind === "buy") {
        holdings[tile.id] = { owner: playerId, level: 1 };
      } else {
        holdings[tile.id] = {
          ...holdings[tile.id],
          level: Math.min(3, holdings[tile.id].level + 1),
        };
      }
      const action = decision.kind === "buy" ? "인수" : "확장";
      setGame({
        ...current,
        players,
        holdings,
        phase: "settling",
        decision: null,
        message: `${players[playerId].name} · ${tile.name} ${action} 완료`,
        log: addLog(
          current.log,
          `${tile.name} ${action} · ${formatMoney(decision.cost)}`,
        ),
        lastEvent: decision.kind === "buy" ? "구역 인수 완료" : "건물 확장 완료",
      });
    } else {
      setGame({
        ...current,
        phase: "settling",
        decision: null,
        message: `${tile.name} 거래를 넘겼습니다.`,
        log: addLog(current.log, `${players[playerId].name} · ${tile.name} 패스`),
        lastEvent: "거래 넘김",
      });
    }
  }, []);

  const revealPoker = useCallback(
    (current: GameState, bet: number, folded: boolean, folder?: PlayerId) => {
      const poker = current.poker;
      if (!poker) return;
      const players = clonePlayers(current.players);
      let winner: PlayerId | null = null;
      let result = "";
      let transfer = 0;

      if (folded && folder !== undefined) {
        winner = otherPlayer(folder);
        transfer = Math.min(FOLD_COST, players[folder].coins);
        players[folder].coins -= transfer;
        players[winner].coins += transfer;
        result = `${players[folder].name} 폴드 · ${players[winner].name} ${formatMoney(transfer)} 획득`;
      } else if (poker.cards[0] === poker.cards[1]) {
        result = `동점 ${cardLabel(poker.cards[0])} · 코인 이동 없음`;
      } else {
        winner = poker.cards[0] > poker.cards[1] ? 0 : 1;
        const loser = otherPlayer(winner);
        transfer = Math.min(bet, players[loser].coins);
        players[loser].coins -= transfer;
        players[winner].coins += transfer;
        result = `${players[winner].name} 승리 · ${formatMoney(transfer)} 획득`;
      }

      const bankrupt = players.some((player) => player.coins <= 0);
      const bankruptPlayer = players.find((player) => player.coins <= 0);
      setGame({
        ...current,
        players,
        phase: bankrupt ? "finished" : "poker",
        winner: bankruptPlayer ? otherPlayer(bankruptPlayer.id) : current.winner,
        poker: {
          ...poker,
          bet,
          stage: "reveal",
          result,
          winner,
          folded,
        },
        message: bankrupt && bankruptPlayer
          ? `${bankruptPlayer.name} 파산 · 게임 종료`
          : result,
        log: addLog(current.log, `포커 · ${result}`),
        lastEvent: folded ? "플레이어 폴드" : "카드 공개",
      });
    },
    [],
  );

  const choosePokerBet = useCallback(
    (bet: number) => {
      const current = gameRef.current;
      const poker = current.poker;
      if (current.phase !== "poker" || !poker || poker.stage !== "bet") return;
      if (
        current.mode === "online" &&
        onlineSessionRef.current?.playerId !== poker.initiator
      ) return;
      const safeBet = Math.min(bet, current.players[poker.initiator].coins);

      if (current.mode === "ai" && poker.responder === 1) {
        const botCard = poker.cards[1];
        const foldChance = botCard <= 4 ? 0.62 : botCard <= 7 ? 0.24 : 0.04;
        const waitingState: GameState = {
          ...current,
          poker: { ...poker, bet: safeBet, stage: "response" },
          message: `검은 여우가 ${formatMoney(safeBet)} 승부를 판단 중…`,
          lastEvent: "상대 생각 중",
        };
        const actionRun = motionRunRef.current;
        setGame(waitingState);
        window.setTimeout(() => {
          if (motionRunRef.current !== actionRun) return;
          if (Math.random() < foldChance) {
            revealPoker(waitingState, safeBet, true, 1);
          } else {
            revealPoker(waitingState, safeBet, false);
          }
        }, 1100);
        return;
      }

      setGame({
        ...current,
        poker: { ...poker, bet: safeBet, stage: "response" },
        message: `${current.players[poker.responder].name} · 콜 또는 폴드`,
        lastEvent: `${formatMoney(safeBet)} 베팅`,
      });
    },
    [revealPoker],
  );

  const pokerCall = () => {
    const current = gameRef.current;
    const poker = current.poker;
    if (!poker || poker.stage !== "response") return;
    if (
      current.mode === "online" &&
      onlineSessionRef.current?.playerId !== poker.responder
    ) return;
    revealPoker(current, poker.bet, false);
  };

  const pokerFold = () => {
    const current = gameRef.current;
    const poker = current.poker;
    if (!poker || poker.stage !== "response") return;
    if (
      current.mode === "online" &&
      onlineSessionRef.current?.playerId !== poker.responder
    ) return;
    revealPoker(current, poker.bet, true, poker.responder);
  };

  const continueAfterPoker = () => {
    const current = gameRef.current;
    if (!current.poker || current.poker.stage !== "reveal") return;
    if (
      current.mode === "online" &&
      onlineSessionRef.current?.playerId !== current.poker.initiator
    ) return;
    setGame({ ...current, phase: "settling", poker: null });
  };

  useEffect(() => {
    if (screen !== "game" || game.phase !== "settling") return;
    if (
      game.mode === "online" &&
      onlineSessionRef.current?.playerId !== game.current
    ) return;
    const timer = window.setTimeout(() => {
      setGame((current) => advanceTurn(current));
    }, 1650);
    return () => window.clearTimeout(timer);
  }, [game, screen]);

  useEffect(() => {
    if (screen !== "game" || game.phase !== "roll") return;
    const active = game.players[game.current];
    if (
      game.mode === "online" &&
      onlineSessionRef.current?.playerId !== game.current
    ) return;
    if (active.skipTurns > 0) {
      const timer = window.setTimeout(() => {
        setGame((current) => {
          const players = clonePlayers(current.players);
          players[current.current].skipTurns -= 1;
          return {
            ...current,
            players,
            phase: "settling",
            message: `${players[current.current].name} 검문으로 차례 정지`,
            log: addLog(current.log, `${players[current.current].name} 차례 건너뜀`),
            lastEvent: "차례 건너뜀",
          };
        });
      }, 1000);
      return () => window.clearTimeout(timer);
    }
    if (game.mode === "ai" && game.current === 1) {
      const timer = window.setTimeout(performRoll, 1250);
      return () => window.clearTimeout(timer);
    }
  }, [game, performRoll, screen]);

  useEffect(() => {
    if (
      screen !== "game" ||
      game.phase !== "decision" ||
      game.mode !== "ai" ||
      game.current !== 1 ||
      !game.decision
    ) {
      return;
    }
    const player = game.players[1];
    const reserve = game.decision.kind === "buy" ? 180 : 250;
    const accept =
      player.coins >= game.decision.cost + reserve &&
      (game.decision.kind === "buy" || Math.random() > 0.28);
    const timer = window.setTimeout(() => resolveDecision(accept), 1300);
    return () => window.clearTimeout(timer);
  }, [game, resolveDecision, screen]);

  useEffect(() => {
    if (game.phase === "finished" && game.winner !== null) {
      const timer = window.setTimeout(() => setScreen("result"), 1300);
      return () => window.clearTimeout(timer);
    }
  }, [game.phase, game.winner]);

  const active = game.players[game.current];
  const activeIsBot = game.mode === "ai" && game.current === 1;
  const activeIsRemote =
    game.mode === "online" && onlineSession?.playerId !== game.current;
  const selectedTile = game.decision ? BOARD[game.decision.tileId] : null;
  const displayedTileId = viewedTileId ?? game.players[game.current].position;
  const guideTile = BOARD[displayedTileId] ?? BOARD[0];
  const guideHolding = game.holdings[guideTile.id];
  const marketHeat = getMarketHeat(game.round);
  const nextHeat = MARKET_HEAT_STAGES.find((stage) => stage.minRound > game.round);
  const guideOwner =
    guideHolding?.owner !== null && guideHolding?.owner !== undefined
      ? game.players[guideHolding.owner]
      : null;
  const guideKind = {
    start: "시작 칸",
    property: "구역",
    event: "암거래 카드",
    poker: "포커 승부",
    tax: "비용 납부",
    inspect: "검문소",
    rest: "휴식 칸",
  }[guideTile.kind];
  const guideRule =
    guideTile.kind === "property"
      ? guideOwner
        ? `${guideOwner.name} 소유 ${guideHolding.level}단계. 지금 도착하면 시장 위험도 ${marketHeat.label}이 적용되어 ${formatMoney(calculateRent(guideTile, guideHolding.level, game.round))}를 냅니다.`
        : `${formatMoney(guideTile.price ?? 0)}에 살 수 있습니다. 구매 후 다시 도착하면 건물을 올려 통행료를 키울 수 있습니다.`
      : guideTile.kind === "start"
        ? `지나갈 때 ${formatMoney(START_BONUS)}, 정확히 도착하면 ${formatMoney(START_LANDING_BONUS)}를 추가로 받습니다.`
        : guideTile.kind === "event"
          ? "좋거나 나쁜 암거래 카드가 무작위로 나옵니다. 돈을 얻거나 잃고, 상대 돈을 뺏거나 한 차례 쉴 수도 있습니다."
          : guideTile.kind === "poker"
            ? `${POKER_BETS.map(formatMoney).join(" · ")} 중 하나를 걸고 승부합니다. 높은 카드가 이기며 폴드하면 ${formatMoney(FOLD_COST)}만 잃습니다.`
            : guideTile.kind === "tax"
              ? `도착 즉시 시장 비용 ${formatMoney(TAX_AMOUNT)}를 은행에 냅니다.`
              : guideTile.kind === "inspect"
                ? "검문에 걸려 다음 자기 차례를 한 번 쉬게 됩니다."
                : `아무 위험 없이 쉬고 보너스 ${formatMoney(REST_BONUS)}를 받습니다.`;

  const renderPlayerPanel = (playerId: PlayerId) => {
    const player = game.players[playerId];
    const meta = PLAYER_META[playerId];
    const owned = BOARD.filter(
      (tile) => game.holdings[tile.id]?.owner === playerId,
    );
    return (
      <article
        className={`player-panel ${meta.className} ${game.current === playerId ? "active" : ""}`}
      >
        <div className="player-identity">
          <span className="player-token" title={`${getSkin(player.skin).name} 말`}>
            {getSkin(player.skin).icon}
          </span>
          <div>
            <small>{playerId + 1}번 · {meta.label}</small>
            <strong>{player.name}</strong>
          </div>
          {game.current === playerId && <i>차례</i>}
        </div>
        <div className="money-line">
          <span>보유 현금</span>
          <strong><b>$</b>{player.coins.toLocaleString("en-US")}</strong>
        </div>
        <div className="asset-metrics">
          <div><span>구역</span><b>{owned.length}</b></div>
          <div><span>순자산</span><b>{formatMoney(netWorth(game, playerId))}</b></div>
          <div><span>정지</span><b>{player.skipTurns}</b></div>
        </div>
        <div className="property-strip" aria-label={`${player.name} 보유 구역`}>
          {owned.length === 0 ? (
            <span className="empty-assets">아직 보유한 구역이 없습니다</span>
          ) : (
            owned.map((tile) => (
              <span
                key={tile.id}
                className="asset-chip"
                style={{ "--asset-color": tile.accent } as CSSProperties}
                title={`${tile.name} ${game.holdings[tile.id].level}단계`}
              >
                {tile.short}<b>{game.holdings[tile.id].level}</b>
              </span>
            ))
          )}
        </div>
      </article>
    );
  };

  const rulesModal = showRules ? (
    <div className="modal-backdrop rules-backdrop">
      <section className="rules-modal" role="dialog" aria-modal="true" aria-label="게임 설명서">
        <button className="rules-close" type="button" onClick={() => setShowRules(false)} aria-label="설명서 닫기">
          ×
        </button>
        <header className="rules-header">
          <p>블랙마켓 · 쉬운 설명서</p>
          <h2>처음 해도 바로 이해하는<br /><em>게임 설명서</em></h2>
          <span>목표는 간단합니다. 상대를 파산시키거나 {MAX_ROUNDS}라운드 뒤 더 부자가 되면 승리합니다.</span>
        </header>

        <div className="online-rules-note">
          <b>온라인 2인</b>
          <span>각자 자기 컴퓨터에서 접속한 뒤, 방장이 만든 6자리 코드를 친구가 입력하면 같은 게임이 실시간으로 연결됩니다.</span>
        </div>

        <div className="rules-steps">
          <article><b>1</b><div><strong>주사위를 굴린다</strong><p>두 주사위 합만큼 한 칸씩 이동합니다. 같은 숫자가 나오면 거래가 끝난 뒤 한 번 더 굴립니다.</p></div></article>
          <article><b>2</b><div><strong>빈 구역은 산다</strong><p>돈이 충분하면 구역을 구매하세요. 내 구역에 다시 도착하면 최대 3단계까지 확장합니다.</p></div></article>
          <article><b>3</b><div><strong>시장이 점점 과열된다</strong><p>7·13·19라운드에 통행료가 올라 마지막에는 기본 통행료 × 건물 레벨 × 2배가 됩니다.</p></div></article>
          <article><b>4</b><div><strong>포커에서는 선택한다</strong><p>내 카드가 높으면 콜하세요. 낮아도 크게 걸어 상대를 폴드시킬 수 있습니다. 에이스(A)가 가장 높습니다.</p></div></article>
        </div>

        <div className="money-cheatsheet">
          <div><span>시작 자금</span><strong>{formatMoney(STARTING_COINS)}</strong></div>
          <div><span>한 바퀴 월급</span><strong>+{formatMoney(START_BONUS)}</strong></div>
          <div><span>세금 칸</span><strong>-{formatMoney(TAX_AMOUNT)}</strong></div>
          <div><span>포커 판돈</span><strong>$50 · $100 · $200</strong></div>
        </div>

        <div className="rules-heat-scale" aria-label="라운드별 시장 위험도">
          {MARKET_HEAT_STAGES.map((stage, index) => (
            <div className={`heat-${stage.level}`} key={stage.level}>
              <small>{stage.minRound}~{(MARKET_HEAT_STAGES[index + 1]?.minRound ?? MAX_ROUNDS + 1) - 1} 라운드</small>
              <strong>{stage.label}</strong>
              <span>통행료 ×{formatMultiplier(stage.multiplier)}</span>
            </div>
          ))}
        </div>

        <p className="tie-break-rule">
          {MAX_ROUNDS}라운드 뒤 순자산이 같으면 남은 현금 → 보유 구역 수 → 건물 단계 → 선공 순서로 승자를 정합니다.
        </p>

        <div className="tile-legend">
          <span><i className="legend-property">▦</i><b>구역</b>구매·건물·통행료</span>
          <span><i className="legend-event">?</i><b>암거래</b>무작위 사건</span>
          <span><i className="legend-poker">♠</i><b>포커</b>베팅·콜·폴드</span>
          <span><i className="legend-tax">$</i><b>세금</b>즉시 비용 납부</span>
        </div>

        <button className="rules-confirm" type="button" onClick={() => setShowRules(false)}>
          이해했어요 · 게임 계속하기
        </button>
      </section>
    </div>
  ) : null;

  if (screen === "menu") {
    return (
      <main className="menu-screen">
        <nav className="menu-nav">
          <div className="brand-lockup">
            <span>BM</span>
            <div><strong>블랙마켓</strong><small>부동산 · 블러프 · 파산</small></div>
          </div>
          <button className="menu-guide-button" type="button" onClick={() => setShowRules(true)}>
            ? 게임 설명서
          </button>
        </nav>

        <section className="menu-hero">
          <div className="hero-art" aria-hidden="true" />
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="kicker"><span>◆</span> 고액 부동산 전략 게임</p>
            <h1>사고, 올리고,<br /><em>거짓말해서 파산시켜라.</em></h1>
            <p className="hero-copy">
              $1,000로 시작해 주사위로 도시를 돌며 구역을 사고 통행료를 키우세요.
              어렵다면 게임 중 오른쪽 칸 설명서와 상단의 전체 설명서를 언제든 볼 수 있습니다.
            </p>
            <section className="game-setup single-player-setup" aria-label="내 플레이어 설정">
              <div className="setup-player cyan">
                <div className="setup-heading">
                  <label htmlFor="nickname-0">내 닉네임</label>
                  <span>인공지능·온라인 공통</span>
                </div>
                <input
                  id="nickname-0"
                  type="text"
                  maxLength={12}
                  value={nicknames[0]}
                  placeholder="닉네임 입력"
                  onChange={(event) => setNicknames([event.target.value, nicknames[1]])}
                />
                <div className="skin-picker">
                  <small>내 말 스킨 선택</small>
                  <div>
                    {TOKEN_SKINS.map((skin) => (
                      <button
                        type="button"
                        className={selectedSkins[0] === skin.id ? "selected" : ""}
                        key={skin.id}
                        title={skin.name}
                        aria-label={`${skin.name} 말 선택`}
                        aria-pressed={selectedSkins[0] === skin.id}
                        onClick={() => setSelectedSkins([skin.id, selectedSkins[1]])}
                      >
                        <span>{skin.icon}</span>
                        <small>{skin.name}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p>온라인에서는 각자 자기 컴퓨터에서 닉네임과 말을 고릅니다.</p>
            </section>
            <div className="menu-actions">
              <button className="primary-action" type="button" onClick={() => startGame("ai")}>
                <span>인공지능과 게임 시작</span><b>→</b>
              </button>
              <button className="secondary-action online-action" type="button" onClick={() => { setOnlineError(""); setShowOnlineMenu(true); }}>
                온라인 2인 대전
              </button>
            </div>
            <div className="hero-rules">
              <div><b>01</b><span>구역 인수</span><small>도착한 땅을 사고 최대 3단계까지 확장</small></div>
              <div><b>02</b><span>포커 블러프</span><small>$50·$100·$200를 걸고 콜 또는 폴드</small></div>
              <div><b>03</b><span>시장 과열</span><small>7·13·19라운드에 통행료 상승 · 최대 2배</small></div>
            </div>
          </div>
        </section>
        {showOnlineMenu && (
          <div className="modal-backdrop online-room-backdrop">
            <section className="online-room-modal" role="dialog" aria-modal="true" aria-label="온라인 2인 대전">
              <button className="rules-close" type="button" onClick={() => setShowOnlineMenu(false)} aria-label="온라인 메뉴 닫기">×</button>
              <header>
                <small>각자 자기 컴퓨터에서 접속</small>
                <h2>온라인 2인 대전</h2>
                <p>한 명이 방을 만들고, 다른 한 명이 전달받은 6자리 코드를 입력하면 바로 연결됩니다.</p>
              </header>
              <div className="online-room-options">
                <article>
                  <span>1</span>
                  <small>방장</small>
                  <strong>새 방 만들기</strong>
                  <p>내 닉네임과 말로 방을 만든 뒤 친구에게 코드를 보내세요.</p>
                  <button type="button" disabled={onlineBusy} onClick={createOnlineRoom}>
                    {onlineBusy ? "방 만드는 중…" : "방 코드 만들기"}
                  </button>
                </article>
                <form onSubmit={(event) => { event.preventDefault(); void joinOnlineRoom(); }}>
                  <span>2</span>
                  <small>참가자</small>
                  <strong>방 코드로 참가</strong>
                  <p>친구에게 받은 6자리 방 코드를 입력하세요.</p>
                  <input
                    type="text"
                    value={joinCode}
                    maxLength={6}
                    inputMode="text"
                    autoComplete="off"
                    placeholder="예: 7K9M2Q"
                    aria-label="방 코드 6자리"
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))}
                  />
                  <button type="submit" disabled={onlineBusy || joinCode.length !== 6}>
                    {onlineBusy ? "연결 중…" : "온라인 방 참가"}
                  </button>
                </form>
              </div>
              {onlineError && <p className="online-error">{onlineError}</p>}
            </section>
          </div>
        )}
        {rulesModal}
      </main>
    );
  }

  if (screen === "result") {
    const winner = game.winner ?? 0;
    const loser = otherPlayer(winner);
    const winnerWorth = netWorth(game, winner);
    const loserWorth = netWorth(game, loser);
    const worthGap = Math.max(0, winnerWorth - loserWorth);
    const winnerProperties = propertyCount(game, winner);
    const loserProperties = propertyCount(game, loser);
    const winnerLevels = buildingLevels(game, winner);
    const loserLevels = buildingLevels(game, loser);
    const bankruptcyWin = game.players[loser].coins <= 0;
    const equalWorth = winnerWorth === loserWorth;
    const equalCash = game.players[winner].coins === game.players[loser].coins;
    const equalProperties = winnerProperties === loserProperties;
    const ledgerTitle = !equalWorth
      ? "최종 순자산 비교 승리"
      : !equalCash
        ? "순자산 동률 · 남은 현금 우세"
        : !equalProperties
          ? "순자산·현금 동률 · 보유 구역 우세"
          : winnerLevels !== loserLevels
            ? "자산 지표 동률 · 건물 단계 우세"
            : "모든 자산 지표 동률 · 선공 우선";
    const ledgerDetail = !equalWorth
      ? `${MAX_ROUNDS}라운드 종료 시 ${game.players[winner].name}의 순자산이 ${formatMoney(winnerWorth)}로, ${game.players[loser].name}의 ${formatMoney(loserWorth)}보다 ${formatMoney(worthGap)} 더 많았습니다.`
      : !equalCash
        ? `두 플레이어의 순자산은 ${formatMoney(winnerWorth)}로 같았지만, ${game.players[winner].name}이 현금을 ${formatMoney(game.players[winner].coins)} 남겨 현금 우선 규칙으로 승리했습니다.`
        : !equalProperties
          ? `순자산과 현금이 모두 같아 보유 구역 수를 비교했고, ${game.players[winner].name}이 ${winnerProperties}개로 ${loserProperties}개보다 많았습니다.`
          : winnerLevels !== loserLevels
            ? `순자산·현금·구역 수가 같아 건물 단계를 비교했고, ${game.players[winner].name}이 총 ${winnerLevels}단계로 앞섰습니다.`
            : `순자산·현금·구역·건물 단계가 모두 같아 마지막 기준인 선공 우선 규칙으로 ${game.players[winner].name}이 승리했습니다.`;
    return (
      <main className="result-screen">
        <div className={`winner-glow ${PLAYER_META[winner].className}`} />
        <section className="result-card">
          <p>시장 폐장 · 최종 정산</p>
          <div className={`result-token ${PLAYER_META[winner].className}`}>
            {getSkin(game.players[winner].skin).icon}
          </div>
          <small>블랙마켓 승자</small>
          <h1>{game.players[winner].name}</h1>
          <div className="final-ledger">
            <div><span>{game.players[0].name}</span><strong>{formatMoney(netWorth(game, 0))}</strong></div>
            <i>{netWorth(game, 0)} : {netWorth(game, 1)}</i>
            <div><span>{game.players[1].name}</span><strong>{formatMoney(netWorth(game, 1))}</strong></div>
          </div>
          <p className="result-note">
            {bankruptcyWin
              ? `${game.players[loser].name}을 파산시키며 시장을 장악했습니다.`
              : `${MAX_ROUNDS}라운드 종료 후 더 높은 순자산으로 승리했습니다.`}
          </p>
          <section className="victory-explanation">
            <small>왜 이겼나요?</small>
            <strong>{bankruptcyWin ? "상대 파산으로 즉시 승리" : ledgerTitle}</strong>
            <p>
              {bankruptcyWin
                ? `${game.players[loser].name}의 현금이 $0이 되었습니다. ${game.players[winner].name}은 현금 ${formatMoney(game.players[winner].coins)}과 구역 ${winnerProperties}개를 지켜 최종 승자가 됐습니다.`
                : ledgerDetail}
            </p>
            <div>
              <span>순자산 차이 <b>{formatMoney(worthGap)}</b></span>
              <span>보유 구역 <b>{winnerProperties} : {loserProperties}</b></span>
              <span>승리 시 현금 <b>{formatMoney(game.players[winner].coins)}</b></span>
              <span>건물 단계 <b>{winnerLevels} : {loserLevels}</b></span>
            </div>
          </section>
          <div className="result-actions">
            <button
              className="primary-action"
              type="button"
              onClick={game.mode === "online" ? returnToMenu : () => startGame("ai")}
            >
              {game.mode === "online" ? "새 온라인 방 찾기" : "다시 거래하기"} <b>↻</b>
            </button>
            <button className="secondary-action" type="button" onClick={returnToMenu}>
              메인으로
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`game-screen heat-${marketHeat.level}`}>
      <header className="game-header">
        <button className="mini-brand" type="button" onClick={returnToMenu}>
          <span>BM</span><strong>블랙마켓</strong>
        </button>
        <div className="round-meter">
          <small>시장 라운드</small>
          <strong>{game.round}<span>/ {MAX_ROUNDS}</span></strong>
          <i style={{ width: `${Math.min(100, (game.round / MAX_ROUNDS) * 100)}%` }} />
        </div>
        <div className="game-header-actions">
          {game.mode === "online" && onlineSession && (
            <div className="online-status-badge">
              <small>온라인 방</small>
              <strong>{onlineSession.code}</strong>
              <span className={onlineConnection === "연결됨" ? "connected" : "reconnecting"}>● {onlineConnection}</span>
            </div>
          )}
          <button className="rules-button" type="button" onClick={() => setShowRules(true)}>
            <b>?</b> 게임 설명서
          </button>
          <button className="exit-button" type="button" onClick={returnToMenu}>나가기</button>
        </div>
      </header>

      <section className={`market-heat-strip heat-${marketHeat.level}`} aria-label={`시장 위험도 ${marketHeat.label}`}>
        <div className="heat-title"><small>시장 위험도</small><strong>{marketHeat.label}</strong></div>
        <div className="heat-bars" aria-hidden="true">
          {MARKET_HEAT_STAGES.map((stage) => <i className={stage.level <= marketHeat.level ? "active" : ""} key={stage.level} />)}
        </div>
        <div className="heat-effect"><span>현재 통행료</span><b>×{formatMultiplier(marketHeat.multiplier)}</b></div>
        <p>{nextHeat ? `${nextHeat.minRound}라운드에 ${nextHeat.label} · ${nextHeat.note}` : "최종 위험 단계 · 한 번의 통행료가 승부를 끝냅니다"}</p>
        <em>⚡ 더블 주사위는 추가 턴</em>
      </section>

      <section className="game-layout">
        <aside className="side-rail left-rail">
          {renderPlayerPanel(0)}
          <div className="turn-console">
            <small>현재 행동</small>
            <strong>{active.name} 차례</strong>
            <p>{game.message}</p>
            <div className="dice-row" aria-label={`주사위 ${game.dice[0]}, ${game.dice[1]}`}>
              <span className={game.phase === "rolling" ? "rolling" : ""}>{DIE_GLYPHS[game.dice[0] - 1]}</span>
              <b>+</b>
              <span className={game.phase === "rolling" ? "rolling delay" : ""}>{DIE_GLYPHS[game.dice[1] - 1]}</span>
            </div>
            {game.bonusTurn === game.current && game.phase !== "roll" && game.phase !== "finished" && (
              <div className="double-bonus">⚡ 더블! 이 행동 뒤 추가 턴</div>
            )}
            <button
              className="roll-button"
              type="button"
              disabled={game.phase !== "roll" || activeIsBot || activeIsRemote || active.skipTurns > 0}
              onClick={performRoll}
            >
              <span>
                {activeIsRemote
                  ? `${active.name} 차례 기다리는 중`
                  : activeIsBot
                  ? "인공지능 계산 중"
                  : game.phase === "roll"
                    ? "주사위 굴리기"
                    : game.phase === "rolling"
                      ? "주사위 굴리는 중"
                      : game.phase === "moving"
                        ? "말 이동 중"
                        : "처리 중"}
              </span>
              <b>스페이스</b>
            </button>
          </div>
        </aside>

        <div className="board-frame">
          <div className="board-glow" />
          <div className="board" role="grid" aria-label="블랙마켓 보드">
            {BOARD.map((tile) => {
              const holding = game.holdings[tile.id];
              const tokens = game.players.filter((player) => player.position === tile.id);
              const style = {
                ...boardPosition(tile.id),
                "--tile-accent": tile.accent ?? "#f0c870",
              } as CSSProperties;
              return (
                <button
                  type="button"
                  className={`board-tile ${tile.kind} ${game.players[game.current].position === tile.id ? "current-tile" : ""} ${displayedTileId === tile.id ? "viewing-tile" : ""}`}
                  style={style}
                  key={tile.id}
                  role="gridcell"
                  title={tile.description}
                  aria-label={`${tile.name} 설명 보기`}
                  onClick={() => setViewedTileId(tile.id)}
                >
                  <span className="tile-number">{String(tile.id).padStart(2, "0")}</span>
                  <b className="tile-icon">{tile.icon}</b>
                  <strong>{tile.short}</strong>
                  {tile.kind === "property" && (
                    <small>{formatMoney(tile.price ?? 0)} · 통행료 {formatMoney(tile.rent ?? 0)}</small>
                  )}
                  {holding?.owner !== null && holding?.owner !== undefined && (
                    <div className={`owner-mark ${PLAYER_META[holding.owner].className}`}>
                      {Array.from({ length: 3 }, (_, level) => (
                        <i className={level < holding.level ? "built" : ""} key={level} />
                      ))}
                    </div>
                  )}
                  <div className="tile-tokens">
                    {tokens.map((player) => (
                      <span
                        className={`map-token ${PLAYER_META[player.id].className} ${game.phase === "moving" && game.current === player.id ? "moving-token" : ""}`}
                        key={player.id}
                        title={`${player.name} · ${getSkin(player.skin).name} 말`}
                      >
                        {getSkin(player.skin).icon}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}

            <section className="board-center">
              <div className="center-seal"><i /><span>BM</span><i /></div>
              <small>{game.lastEvent}</small>
              <h2>{game.message}</h2>
              <div className={`center-dice ${game.phase === "rolling" ? "rolling" : ""} ${game.bonusTurn === game.current ? "double" : ""}`}>
                <span>{DIE_GLYPHS[game.dice[0] - 1]}</span>
                <span>{DIE_GLYPHS[game.dice[1] - 1]}</span>
              </div>
              {game.bonusTurn === game.current && game.phase !== "roll" && game.phase !== "finished" && (
                <div className="center-double-bonus">더블 · 추가 턴 확보</div>
              )}
              <div className="market-rule">
                <b>통행료</b>
                <span>건물 단계 × 시장 {formatMultiplier(marketHeat.multiplier)}배</span>
                <i />
                <b>출발</b>
                <span>한 바퀴 {formatMoney(START_BONUS)}</span>
              </div>
            </section>
          </div>
        </div>

        <aside className="side-rail right-rail">
          {renderPlayerPanel(1)}
          <section
            className="tile-guide"
            style={{ "--guide-color": guideTile.accent ?? "#f0c870" } as CSSProperties}
          >
            <div className="guide-heading">
              <div>
                <small>도착 칸 설명서</small>
                <span>보드의 다른 칸을 눌러도 확인 가능</span>
              </div>
              <b>{String(guideTile.id).padStart(2, "0")}</b>
            </div>
            <div className="guide-title">
              <span>{guideTile.icon}</span>
              <div><small>{guideKind}</small><strong>{guideTile.name}</strong></div>
            </div>
            <p className="guide-description">{guideTile.description}</p>
            <div className="guide-rule">
              <small>이 칸에 도착하면</small>
              <strong>{guideRule}</strong>
            </div>
            {guideTile.kind === "property" && (
              <div className="guide-values">
                <div><span>구매 가격</span><b>{formatMoney(guideTile.price ?? 0)}</b></div>
                <div><span>현재 통행료</span><b>{formatMoney(calculateRent(guideTile, guideHolding?.level ?? 1, game.round))}</b></div>
                <div><span>현재 상태</span><b>{guideOwner ? `${guideOwner.name} · ${guideHolding.level}단계` : "주인 없음"}</b></div>
              </div>
            )}
            <button className="guide-rules-link" type="button" onClick={() => setShowRules(true)}>
              전체 게임 설명서 보기 →
            </button>
          </section>
          <section className="market-log">
            <div className="panel-title"><small>실시간 거래 기록</small><span>● 기록 중</span></div>
            <div className="log-list">
              {game.log.map((entry, index) => (
                <p key={`${entry}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b>{entry}</p>
              ))}
            </div>
          </section>
        </aside>
      </section>

      {game.mode === "online" && game.phase === "waiting" && onlineSession && (
        <div className="modal-backdrop waiting-room-backdrop">
          <section className="waiting-room-modal" role="dialog" aria-modal="true" aria-label="온라인 상대 대기">
            <span className="waiting-signal"><i /><i /><i /></span>
            <small>온라인 방이 준비됐습니다</small>
            <h2>친구에게 이 코드를 보내세요</h2>
            <button className="room-code-copy" type="button" onClick={copyRoomCode}>
              <strong>{onlineSession.code}</strong>
              <span>{roomCodeCopied ? "복사 완료!" : "눌러서 복사"}</span>
            </button>
            <div className="waiting-steps">
              <span><b>1</b>친구가 자기 컴퓨터에서 블랙마켓 접속</span>
              <span><b>2</b>온라인 2인 대전 → 방 코드로 참가</span>
              <span><b>3</b>코드 입력 즉시 게임 시작</span>
            </div>
            <p>상대 입장을 확인하는 중입니다. 이 화면을 그대로 두세요.</p>
            <button className="waiting-cancel" type="button" onClick={returnToMenu}>방 나가기</button>
          </section>
        </div>
      )}

      {game.phase === "decision" && game.decision && selectedTile && (
        <div className="modal-backdrop">
          <section className={`deal-modal ${PLAYER_META[game.current].className}`}>
            <p>{game.decision.kind === "buy" ? "새 구역 인수" : "보유 구역 확장"}</p>
            <div className="deal-icon" style={{ "--deal-color": selectedTile.accent } as CSSProperties}>
              {selectedTile.icon}
            </div>
            <small>{selectedTile.short}</small>
            <h2>{selectedTile.name}</h2>
            <p className="deal-description">{selectedTile.description}</p>
            <div className="deal-numbers">
              <div><span>거래 가격</span><strong>{formatMoney(game.decision.cost)}</strong></div>
              <div><span>예상 통행료</span><strong>{formatMoney((selectedTile.rent ?? 0) * (game.decision.kind === "upgrade" ? Math.min(3, (game.holdings[selectedTile.id]?.level ?? 0) + 1) : 1))}</strong></div>
              <div><span>거래 후 잔액</span><strong>{formatMoney(active.coins - game.decision.cost)}</strong></div>
            </div>
            {activeIsBot ? (
              <div className="bot-thinking"><i /><span>검은 여우가 수익률을 계산 중…</span></div>
            ) : activeIsRemote ? (
              <div className="remote-thinking"><i /><span>{active.name}이 거래를 선택하는 중…</span></div>
            ) : (
              <div className="modal-actions">
                <button type="button" className="ghost-button" onClick={() => resolveDecision(false)}>패스</button>
                <button
                  type="button"
                  className="gold-button"
                  disabled={active.coins < game.decision.cost}
                  onClick={() => resolveDecision(true)}
                >
                  {active.coins < game.decision.cost ? "잔액 부족" : game.decision.kind === "buy" ? "구역 인수" : "건물 확장"}
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {game.phase === "poker" && game.poker && (
        <div className="modal-backdrop">
          <section className="poker-modal">
            <div className="poker-header">
              <p>비밀 테이블 · 한 장 블러프</p>
              <span>♠</span>
              <h2>블러프 룸</h2>
              <small>높은 카드가 이긴다. 낮은 카드라도 상대를 폴드시킬 수 있다.</small>
            </div>
            <div className="poker-table">
              {([0, 1] as PlayerId[]).map((playerId) => {
                const poker = game.poker!;
                const isVisible = poker.stage === "reveal" || (
                  game.mode === "online"
                    ? onlineSession?.playerId === playerId
                    : (poker.stage === "bet" && playerId === poker.initiator) ||
                      (poker.stage === "response" && playerId === poker.responder)
                );
                return (
                  <div className={`poker-seat ${PLAYER_META[playerId].className}`} key={playerId}>
                    <span>{game.players[playerId].name}</span>
                    <div className={`number-card ${isVisible ? "visible" : "hidden"}`}>
                      {isVisible ? <><small>블랙</small><strong>{cardLabel(poker.cards[playerId])}</strong><b>♠</b></> : <i>암시장</i>}
                    </div>
                    <small>{isVisible ? "내 카드" : "상대 카드"}</small>
                  </div>
                );
              })}
              <div className="poker-pot"><small>현재 판돈</small><strong>{formatMoney(game.poker.bet)}</strong></div>
            </div>

            {game.poker.stage === "bet" && (
              <div className="poker-controls">
                {game.mode !== "online" || onlineSession?.playerId === game.poker.initiator ? (
                  <>
                    <p>얼마를 걸고 승부할까요?</p>
                    <div>
                      {POKER_BETS.map((bet) => (
                        <button
                          type="button"
                          key={bet}
                          disabled={game.players[game.poker!.initiator].coins < bet}
                          onClick={() => choosePokerBet(bet)}
                        >
                          <small>베팅</small><strong>{formatMoney(bet)}</strong>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="poker-waiting"><i /><span>{game.players[game.poker.initiator].name}이 판돈을 고르는 중…</span></div>
                )}
              </div>
            )}

            {game.poker.stage === "response" && (
              <div className="poker-response">
                <p>{game.players[game.poker.initiator].name}이 {formatMoney(game.poker.bet)}를 걸었습니다.</p>
                {game.mode !== "online" || onlineSession?.playerId === game.poker.responder ? (
                  <div>
                    <button type="button" className="fold-button" onClick={pokerFold}>폴드 · {formatMoney(FOLD_COST)} 포기</button>
                    <button type="button" className="call-button" onClick={pokerCall}>콜 · 카드 공개</button>
                  </div>
                ) : (
                  <div className="poker-waiting"><i /><span>{game.players[game.poker.responder].name}이 콜 또는 폴드를 선택하는 중…</span></div>
                )}
              </div>
            )}

            {game.poker.stage === "reveal" && (
              <div className="poker-result">
                <small>최종 공개</small>
                <strong>{game.poker.result}</strong>
                {game.mode !== "online" || onlineSession?.playerId === game.poker.initiator ? (
                  <button type="button" onClick={continueAfterPoker}>계속하기 →</button>
                ) : (
                  <div className="poker-waiting"><i /><span>상대가 결과를 확인하는 중…</span></div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
      {rulesModal}
    </main>
  );
}
