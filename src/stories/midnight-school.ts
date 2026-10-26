// シナリオデータ: 『午前0時の校舎』
// エンジン（src/logic.ts）とは分けて、作品ごとにこの形式のファイルを1つ置く。
// 作品を足すときは、同じ形式のファイルを増やして src/stories/index.ts に登録する。
import type { Story } from '../logic';

export const midnightSchool: Story = {
  id: 'midnight-school',
  title: '午前0時の校舎',
  description: '真夜中の校舎に一人取り残された。名前を呼ばれても、返事をしてはいけない。',
  length: '5〜10分',
  cover: 'classroom',
  coverLines: ['午前0時', 'の校舎'],
  start: 'start1',
  nodes: {
    start1: {
      id: 'start1', bg: 'classroom',
      text: '文化祭を明日に控えた金曜日。3年2組の教室で、クラス展示の看板を仕上げていたのは、私、久瀬遥、ただ一人だった。',
      next: 'start2',
    },
    start2: {
      id: 'start2',
      text: '夕方から降り始めた雨は、窓を叩く音をだんだん強くしていた。帰る頃には止むだろう、と高をくくっていた。',
      next: 'start3',
    },
    start3: {
      id: 'start3',
      text: '仕上がった看板を壁に立てかけたとき、急に眠気が来た。少しだけ、と机に伏せたのが間違いだった。',
      next: 'start4',
    },
    start4: {
      id: 'start4',
      text: '目が覚めたとき、教室の時計は午後11時57分を指していた。蛍光灯は点いたままなのに、廊下の気配がまるでない。',
      next: 'start5',
    },
    start5: {
      id: 'start5', se: 'phone',
      text: 'スマホの電池は残り1%。同級生の佐伯に「まだ学校にいる」とだけ送ると、画面は黒く落ちた。',
      next: 'choice_light',
    },
    choice_light: {
      id: 'choice_light',
      text: '廊下は真っ暗だ。教室を出る前に、どうする。',
      choices: [
        { label: '教室の後ろの棚から、懐中電灯を持っていく', to: 'light_take1' },
        { label: '明かりはなくても、昇降口までなら行ける。そのまま出る', to: 'light_leave1' },
      ],
    },
    light_take1: {
      id: 'light_take1', set: ['flashlight'],
      text: '防災用の懐中電灯。スイッチを入れると、思ったより明るく点いた。これなら足元は大丈夫だ。',
      next: 'light_take2',
    },
    light_take2: {
      id: 'light_take2',
      text: 'ドアを開ける。蛍光灯の消えた廊下に、雨の音だけが響いていた。',
      next: 'corridor1',
    },
    light_leave1: {
      id: 'light_leave1',
      text: 'ポケットにスマホをしまう。点かない画面は、ただの板だった。',
      next: 'light_leave2',
    },
    light_leave2: {
      id: 'light_leave2',
      text: 'ドアを開ける。蛍光灯の消えた廊下に、雨の音だけが響いていた。',
      next: 'corridor1',
    },
    corridor1: {
      id: 'corridor1', bg: 'corridor',
      text: '非常灯の緑色の明かりが、等間隔に廊下を照らしている。自分の上履きの音が、やけに大きく聞こえた。',
      next: 'corridor2',
    },
    corridor2: {
      id: 'corridor2',
      text: 'ふと、階段の手前で足を止めた。床に、濡れた足跡があった。',
      next: 'corridor3',
    },
    corridor3: {
      id: 'corridor3',
      text: '小さな足跡だ。私のものじゃない。足跡は上の階から降りてきて——私の前で、止まっていた。',
      next: 'choice_music',
    },
    choice_music: {
      id: 'choice_music',
      text: '足跡は、上の階の音楽室の前で途切れている。どうする。',
      choices: [
        { label: '足跡をたどって、音楽室をのぞく', to: 'music1' },
        { label: '気味が悪い。足跡を避けて、下の階へ急ぐ', to: 'down1' },
      ],
    },
    music1: {
      id: 'music1', bg: 'music', se: 'piano',
      text: '音楽室のドアは、少しだけ開いていた。中から、ピアノの音がひとつ、鳴った。',
      next: 'music2',
    },
    music2: {
      id: 'music2',
      text: '黒板に、チョークの字があった。『0時をまわったら —— 名前を呼ばれても、返事をするな。うしろを、ふりかえるな』',
      next: 'music3',
    },
    music3: {
      id: 'music3',
      text: '字の乱れ方から、書いた人も怖かったのだと思う。私はその2つを、頭の中で繰り返した。',
      next: 'music4',
    },
    music4: {
      id: 'music4',
      text: '譜面台の上には、濡れた片方だけの上履きが置いてあった。サイズは、私のものとよく似ていた。',
      next: 'stairs1',
    },
    down1: {
      id: 'down1', bg: 'stairs', se: 'piano',
      text: '階段を降り始めたとき、上の階でピアノの音がひとつ鳴った。振り返りたい気持ちを抑えて、先を急いだ。',
      next: 'down2',
    },
    down2: {
      id: 'down2',
      text: 'けれど音楽室の前を通らなかったことが、あとあとまで気になった。何か、大事なことを見落としている気がした。',
      next: 'stairs1',
    },
    stairs1: {
      id: 'stairs1', bg: 'stairs', se: 'chime',
      text: '階段を降りる。踊り場の時計の針が、0時を指した。',
      next: 'stairs2',
    },
    stairs2: {
      id: 'stairs2',
      text: 'そのときだった。下の階から、私の名前を呼ぶ声がした。',
      next: 'voice1',
    },
    voice1: {
      id: 'voice1', se: 'whisper',
      text: '『遥ー、どこー』　声は佐伯にそっくりだった。でも、佐伯が今ここにいるはずがない。',
      next: 'choice_voice',
    },
    choice_voice: {
      id: 'choice_voice',
      text: '声はもう一度、私の名前を呼んだ。',
      choices: [
        { label: '返事をする', to: 'answer1' },
        { label: '返事をせず、昇降口へ急ぐ', to: 'silent1' },
      ],
    },
    answer1: {
      id: 'answer1',
      text: '「ここだよ」　言った瞬間、声がぴたりと止んだ。',
      next: 'answer2',
    },
    answer2: {
      id: 'answer2', bg: 'dark',
      text: 'そして、すぐ後ろで。『みつけた』',
      next: 'end_voice',
    },
    end_voice: {
      id: 'end_voice', bg: 'dark',
      text: '振り返るより先に、冷たい手が私の肩に置かれた。——翌朝、教室の私の席には、濡れた上履きを履いた「私」が座っていたという。',
      ending: { kind: 'bad', title: 'バッドエンド「返事」' },
    },
    silent1: {
      id: 'silent1',
      text: '口を固く閉じ、声をやり過ごす。声は2度呼んで、雨の音にまぎれて消えた。',
      next: 'silent2',
    },
    silent2: {
      id: 'silent2', bg: 'entrance',
      text: '昇降口にたどり着いた。ガラスの向こうは雨で、街灯がにじんで見えた。',
      next: 'entrance1',
    },
    entrance1: {
      id: 'entrance1',
      text: '私の下駄箱が、開いていた。中にあるはずの靴が、ない。',
      next: 'entrance2',
    },
    entrance2: {
      id: 'entrance2',
      text: '代わりに、濡れた小さな足跡が、下駄箱から昇降口の真ん中まで続いていた。',
      next: 'entrance3',
    },
    entrance3: {
      id: 'entrance3', se: 'knock',
      text: 'その足跡の先、昇降口の真ん中で、ガラス扉を内側から叩く音がした。誰もいないのに。',
      next: 'blackout1',
    },
    blackout1: {
      id: 'blackout1', bg: 'dark',
      text: '次の瞬間、非常灯がすべて落ちた。完全な暗闇の中で、背後に人の気配があった。',
      next: 'blackout2',
    },
    blackout2: {
      id: 'blackout2',
      text: '濡れた足跡の音が、ひとつ、またひとつと近づいてくる。ふりかえってはいけない、と本能が告げていた。',
      next: 'choice_final',
    },
    choice_final: {
      id: 'choice_final',
      text: '足音は、すぐ後ろで止まった。',
      choices: [
        { label: '振り返らず、裏口へ走る', to: 'run_dark1', toIfFlag: { flag: 'flashlight', to: 'run_light1' } },
        { label: '振り返って、確かめる', to: 'lookback1' },
      ],
    },
    run_light1: {
      id: 'run_light1', se: 'steps',
      text: '懐中電灯の明かりで足元を照らし、裏口への廊下を走った。足音はついてきたが、明かりの中には入ってこなかった。',
      next: 'run_light2',
    },
    run_light2: {
      id: 'run_light2', bg: 'outside', se: 'rain',
      text: '裏口のドアノブに手をかけると、鍵は開いていた。文化祭の搬入で、夕方に開けたままだったのかもしれない。雨の中へ飛び出し、振り返らないまま、校門まで走った。',
      next: 'end_happy',
    },
    run_dark1: {
      id: 'run_dark1', bg: 'dark', se: 'steps',
      text: '走り出した途端、暗闇で段差に足を取られた。転んだ私の目の前に、濡れた足跡が止まった。',
      next: 'end_caught',
    },
    lookback1: {
      id: 'lookback1', bg: 'dark',
      text: 'だめだ、と思いながら、体が勝手に振り返っていた。',
      next: 'end_caught',
    },
    end_caught: {
      id: 'end_caught', bg: 'dark',
      text: 'そこにいたのは、私だった。濡れた上履きを履いた私が、笑って言った。『つぎは、わたしが かえるね』——翌朝、教室の私の席には、もう一人の「私」が座っていたという。',
      ending: { kind: 'bad', title: 'バッドエンド「振り返るな」' },
    },
    end_happy: {
      id: 'end_happy', bg: 'outside',
      text: '家に帰り着いたのは、0時をだいぶ過ぎていた。翌朝、学校で私の靴は下駄箱に戻っていた。中には小さな紙が入っていた。『こんどは、かえしてあげる』。雨の匂いのする紙を、私は誰にも見せていない。',
      ending: { kind: 'happy', title: 'ハッピーエンド「夜明けの雨」' },
    },
  },
};
