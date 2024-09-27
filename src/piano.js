// じゃあクラス化しようね
// ...

// envelopeを複数用意して
// 叩くたびに別のが起動する

// 詳しく知りたい人のためのQiita（じっくり読もう）
// https://qiita.com/naberyo34/items/7aa5e2f610b5895e9f6b
// webAudioAPIについて
// https://developer.mozilla.org/ja/docs/Web/API/Web_Audio_API
// webMusicについて
// https://korilakkuma.github.io/Web-Music-Documentation/

// foxIAの仕様変更でfactoryがnullを返す場合にはポインターが生成されない
// ようにしました. ダブルタップ関連の処理も実行されない....
// これにより分岐処理でfactoryにnullを返させることで
// actxの初期化を待てるようになります（たぶん！）

// キーごとにエージェントを用意すればいい
// そんでもって
// キーエージェントの継承を作ればいいと思う。

// できたようです。

// スマホだとキーボード要らないので
// pixiの裏技を使います

// D,H,Kの同時押しできないからロジックがバグってるのかと思ったら
// どうやら仕様らしい
// 特定の3つのキーの同時押しができない仕様が存在するという
// そうなんだ...
// で、スマホだと普通に同時押しできたので、まあタブレットとかなら大丈夫かと。
// 以上です。ロジックはOKぽいです。

// legato導入できたにょ
// ロジック変更だそうです。
// ざっくりいうとkeyのvalueを比較する方法で判定しようと。で、
// 取得の際に先にキーが取れるかどうか調べる。
// 今のロジックだと先にenvをリザーブしてしまうので
// activateされてないのにenvが捕捉されてしまうのです。
// それは困る。
// KeyAgentについてはキーの取得が前提なので問題ないです

// pixiがこういうのやってた
/** 端末ごとにパフォーマンスを調整するための変数です。 */
const nav = window.navigator;
let isMobile = false;
if (nav.platform !== undefined) {
  // platformが定義されている場合
  switch (nav.platform) {
    case "Win32": // Windowsだったら
    case "MacIntel": // OS Xだったら
      isMobile = false;
      break;
    case "iPhone": // iPhoneだったら
    default:
      // その他の端末も
      isMobile = true;
  }
} else if (nav.userAgentData !== undefined) {
  // userAgentDataが利用可能な場合
  if (nav.userAgentData.mobile) {
    isMobile = true;
  } else {
    isMobile = false;
  }
} else {
  // いずれでもなければtrueにする
  isMobile = true;
}

// 主な変更点
// configを導入して音量とオシレータタイプを変えられるようにした
// 線を描画するのはキーボードを塗った後
// 鍵盤を2つ追加
// 線の色を青系統に変更
// 変更点追加
// pedalWeightとreverbを追加
// keyboardがconfigを反映してない問題を修正
// oscTypeとvolumeもconfigで決める、可変部分をfreqだけにする
// オシレータの数を24個に増量
// 変更は以上です

const config = {
  oscType: "triangle",
  volume: 0.5,
  pedalWeight:0.5, // ペダルの重さ
  reverb:0 // 残響
}

function createGUI(){
  const gui = new lil.GUI();
  gui.add(config, "oscType", ["triangle","square","sine","sawtooth"]);
  gui.add(config, "volume", 0, 1, 0.01);
  gui.add(config, "pedalWeight", 0, 1, 0.01);
  gui.add(config, "reverb", 0, 1, 0.01);
  // このように書くとデフォルトで閉じていてくれる
  gui.close();
}

let guide;
let cover;

let actx;
//const actx = new AudioContext();

// cf:https://openprocessing.org/sketch/1966344
const lineColorPalette = [
  "blue","aquamarine","turquoise","teal","seagreen",
  "navy","deepskyblue","dodgerblue","steelblue","royalblue"
];

let IA;
let KA;

let envArray = [];

const whiteKeys = [];
const blackKeys = [];
const allKeys = [];
const whiteKeyArray = [-3,-1,0,2,4,5,7,9,11,12,14,16,17,19,21,23,24,26];
const blackKeyArray = [
  -4, -2, 999, 1, 3, 999, 6, 8, 10, 999, 13, 15, 999, 18, 20, 22, 999, 25, 27
];
// [-3,-1,0,2,4,5,7,9,11,12,14,16,17,19,21,22]
const freqMap = {
  KeyA:-3, KeyS:-1, KeyD:0, KeyF:2, KeyG:4, KeyH:5, KeyJ:7, KeyK:9, KeyL:11,
  Semicolon:12, Quote:14, Backslash:16, Enter:17, Numpad4:19,Numpad5:21, Numpad6:23,
  NumpadAdd:24,
  KeyQ:-4,KeyW:-2, KeyR:1, KeyT:3, KeyU:6, KeyI:8, KeyO:10, BracketLeft:13,
  BracketRight:15, Numpad7:18, Numpad8:20,Numpad9:22
};

let keyMapGuide;

function preload(){
  keyMapGuide = loadImage("https://inaridarkfox4231.github.io/assets/backgrounds/keyMap.png")
}

function setup() {
  createCanvas(900, (isMobile ? 400 : 800));
  pixelDensity(1);
  createGUI();

  IA = new foxIA.Interaction(this.canvas, {factory:()=>{
    if(actx === undefined){
      return null;
    }
    return new OscillatorPointer();
  }});

  for(let i=0;i<24;i++){
    envArray.push(new SpringEnvelope());
  }

  //initializeEnvelopes();
  const LC = new foxIA.Locater(this.canvas);
  LC.setAction({activate:initializeEnvelopes});

  strokeWeight(2);
  for(let i=0; i<whiteKeyArray.length; i++){
    whiteKeys.push(new RectFigure(
      whiteKeyArray[i], i*50, 200, 50, 200
    ));
  }
  for(let i=0;i<blackKeyArray.length;i++){
    if(blackKeyArray[i]>100)continue;
    blackKeys.push(new RectFigure(
      blackKeyArray[i], -25+i*50, 0, 50, 200
    ));
  }
  allKeys.push(...whiteKeys);
  allKeys.push(...blackKeys);
  allKeys.sort((k0,k1) => {
    if(k0.getValue()<k1.getValue())return -1;
    if(k0.getValue()>k1.getValue())return 1;
    return 0;
  });

  guide = createGraphics(900,400);
  displayKeys(guide);
  guide.noStroke().fill(255).textAlign(LEFT,TOP).textSize(16).textStyle(ITALIC);
  guide.text("mouse,touch,stylus is available.",5,5);

  cover = createGraphics(900, 400);
  cover.fill(255, 128, 64);

  KA = new foxIA.KeyAction(this.canvas, {
    keyAgentFactory:(code)=>new OscillatorKeyAgent(code)
  });
  // KeyCodeの可視化
  //KA.enable("showKeyCode");

  for(const code of Object.keys(freqMap)){
    KA.registAction(code, {
      activate:(t,a)=>{
        a.capture();
      },
      inActivate:(t,a)=>{
        a.release();
      }
    });
  }
}

function draw() {
  background(128);

  image(guide,0,0);
  if(!isMobile){
    image(keyMapGuide,0,400);
  }

  cover.background(0,24);
  blendMode(DIFFERENCE);
  image(cover,0,0);
  blendMode(BLEND);

  for(const e of envArray){
    e.updateState();
    e.drawLine();
  }

  // 初期化前は暗くする処理
  if(actx===undefined){background(0,128);}
}

class OscillatorKeyAgent extends foxIA.KeyAgent{
  constructor(code){
    super(code);
    this.env = null;
  }
  capture(){
    const env = getEnvelope();
    if(env === null)return;
    const keyValue = freqMap[this.code];
    const freq = 440*Math.pow(2,(3+keyValue)/12);
    this.env = env;
    this.env.play({freq:freq});
    this.env.captureKeyBoard(allKeys[keyValue+4]);
  }
  release(){
    if(this.env===null)return;
    this.env.free();
  }
}

class OscillatorPointer extends foxIA.PointerPrototype{
  constructor(){
    super();
    this.env = null;
  }
  capture(){
    // 先にキーを捕捉し、失敗したら何もしない。
    const k = getKey(this.x, this.y);
    if(k === null)return;
    // キーが捕捉できたらenvを捕捉する
    this.env = getEnvelope();
    if(this.env === null) return;
    this.env.play({
      freq:440*pow(2,(3+k.getValue())/12)
    });
    this.env.captureKeyBoard(k);
    //k.display(cover);
  }
  legato(){
    // とらえたキーのvalueとthis.env.keyboard.getValue()を比較
    if(this.env===null)return;
    const k = getKey(this.x, this.y);
    if(k===null)return;
    // ここで比較する。同じ場合は乗り換えない。
    if(k.getValue() === this.env.getValue())return;
    //if(k.isCaptured())return;
    this.release();
    this.env = getEnvelope();
    if(this.env===null)return;
    this.env.play({
      freq:440*pow(2,(3+k.getValue())/12)
    });
    this.env.captureKeyBoard(k);
  }
  release(){
    if(this.env === null)return;
    this.env.free();
  }
  mouseDownAction(e){
    this.capture();
  }
  mouseMoveAction(e){
    this.legato();
  }
  mouseUpAction(){
    this.release();
  }
  touchStartAction(t){
    this.capture();
  }
  touchMoveAction(t){
    this.legato();
  }
  touchEndAction(){
    this.release();
  }
}

// キー描画
function displayKeys(target){
  target.push();
  target.stroke(0);
  target.fill(255);
  for(const wk of whiteKeys){
    wk.display(target);
  }
  target.stroke(255);
  target.fill(0);
  for(const bk of blackKeys){
    bk.display(target);
  }
  target.pop();
}

// キー取得
function getKey(x, y){
  for(const wk of whiteKeys){
    if(wk.hit(x,y)) return wk;
  }
  for(const bk of blackKeys){
    if(bk.hit(x,y)) return bk;
  }
  return null;
}

// envelope初期化
function initializeEnvelopes(){
  if(actx !== undefined) return;
  actx = new AudioContext();
  for(const e of envArray){
    e.initialize(actx);
  }
}

// envelope取得
function getEnvelope(){
  const candidates = envArray.filter((e) => !e.isPlaying);
  if(candidates.length>0) return random(candidates);
  return null;
}

// envelope
class SpringEnvelope{
  constructor(){
    this.ctx = null;
    this.osc = null;
    this.gain = null;
    this.volumeRatio = 0;
    this.maxVolume = 1;
    this.upCoeff = 0.85;
    this.downCoeff = 0.85;
    this.isPlaying = false;
    this.isCaptured = false;
    this.alreadyStarted = false;
    this.muteThreshold = 0.01;

    this.keyboard = null;

    this.lineColor = random(lineColorPalette);
  }
  captureKeyBoard(k){
    this.keyboard = k;
  }
  displayKeyBoard(){
    if(this.keyboard===null)return;
    this.keyboard.display(cover);
  }
  releaseKeyBoard(){
    if(this.keyboard===null)return;
    this.keyboard = null;
  }
  getValue(){
    // 補足してるキーの...valueを出す。無い場合はnullを返す。
    if(this.keyboard===null)return null;
    return this.keyboard.getValue();
  }
  initialize(ctx){
    this.ctx = ctx;
    this.osc = actx.createOscillator();
    this.gain = actx.createGain();
  }
  play(params = {}){
    // upCoeff:0.55～0.95: pedalWeight:0～1で設定する。default:0.5（つまり0.75）
    // downCoeff:0.85～0.95: reverb:0～1で設定する.default:0（つまり0.85）
    const defaultUpCoeff = 0.55 + 0.4*config.pedalWeight;
    const defaultDownCoeff = 0.85 + 0.1*config.reverb;
    const defaultOscType = config.oscType;
    const defaultMaxVolume = config.volume;
    const {
      type = defaultOscType, freq = 440,
      upCoeff = defaultUpCoeff, downCoeff = defaultDownCoeff,
      maxVolume = defaultMaxVolume
    } = params;
    this.upCoeff = upCoeff;
    this.downCoeff = downCoeff;
    this.maxVolume = maxVolume;

    const t = actx.currentTime;

    this.osc.type = type;
    this.osc.frequency.setValueAtTime(freq, t);
    this.gain.gain.setValueAtTime(0, t);

    this.osc.connect(this.gain);
    this.gain.connect(actx.destination); // つなぎなおし。

    this.isPlaying = true;
    this.isCaptured = true;

    // startは最初の1回だけ
    if(!this.alreadyStarted){
      this.osc.start();
      this.alreadyStarted = true;
    }
  }
  getVolume(){
    return this.volumeRatio*this.maxVolume;
  }
  getVolumeRatio(){
    return this.volumeRatio;
  }
  drawLine(){
    if(!this.isPlaying)return;
    const y = 400*(1-this.volumeRatio);
    stroke(this.lineColor);
    line(0,y,width,y);
  }
  updateVolume(){
    this.gain.gain.setValueAtTime(
      this.volumeRatio * this.maxVolume, actx.currentTime
    );
  }
  updateState(){
    if(!this.isPlaying)return;
    if(this.isCaptured){
      this.volumeRatio = 1-(1-this.volumeRatio)*this.upCoeff;
      this.updateVolume();
      this.displayKeyBoard();
    }else{
      this.volumeRatio *= this.downCoeff;
      this.updateVolume();
    }
    if(this.volumeRatio < this.muteThreshold){
      this.mute();
    }
  }
  free(){
    this.isCaptured = false;
    this.releaseKeyBoard();
  }
  mute(){
    this.volume = 0;
    //this.updateVolume();
    this.gain.disconnect(); // これでもいいの？
    this.isPlaying = false;
  }
}

// 当たり判定用
// targetをthisにすれば直に描画できる
// 注意

class FigureObject{
  constructor(v){
    this.value = v;
  }
  hit(x, y){
    return true;
  }
  display(target){}
  getValue(){
    return this.value;
  }
}

class RectFigure extends FigureObject{
  constructor(v, x, y, w, h){
    super(v);
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
  hit(x, y){
    return (x>=this.x) && (x<=this.x+this.w) && (y>=this.y) && (y<=this.y+this.h);
  }
  display(target){
    target.rect(this.x, this.y, this.w, this.h);
  }
}

class CircleFigure extends FigureObject{
  constructor(v, x, y, r){
    super(v);
    this.x = x;
    this.y = y;
    this.r = r;
  }
  hit(x, y){
    return Math.hypot(x-this.x, y-this.y) <= this.r;
  }
  display(target){
    target.circle(this.x, this.y, this.r*2);
  }
}
