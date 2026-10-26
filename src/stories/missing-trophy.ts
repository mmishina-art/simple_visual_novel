// シナリオデータ: 『消えた優勝杯』（推理もの）
// エンジン（src/logic.ts）とは分けて、作品ごとにこの形式のファイルを1つ置く。
import type { Story } from '../logic';

export const missingTrophy: Story = {
  id: 'missing-trophy',
  title: '消えた優勝杯',
  description: '文化祭の朝、展示室の優勝杯が消えた。鍵は内側から掛かっていた――密室の謎を解く。',
  length: '10〜15分',
  cover: 'trophy',
  coverObi: 'navy',
  coverLines: ['消えた', '優勝杯'],
  bgm: 'mystery',
  start: 'start1',
  nodes: {
    start1: {
      id: 'start1', bg: 'trophy',
      text: '文化祭の朝。クラス対抗展の優勝杯を展示室へ運ぶ係は、私、高嶺あかりだった。式は昼から。優勝杯はステージに飾られる。',
      next: 'start2',
    },
    start2: {
      id: 'start2', se: 'door',
      text: '展示室の鍵を開けて、息をのんだ。ガラスケースの中が、空だった。昨日、確かにここへしまったのに。',
      next: 'start3',
    },
    start3: {
      id: 'start3',
      text: '不思議なのは、ドアのチェーンロックだ。昨日の夕方、私が外から施錠したとき、チェーンは掛かっていなかったはずなのに、今は内側から掛かっている。',
      next: 'start4',
    },
    start4: {
      id: 'start4',
      text: '中からしか掛けられないチェーンが掛かっているのに、部屋に人はいない。そして優勝杯だけがない。――密室、というやつだった。',
      next: 'start5',
    },
    start5: {
      id: 'start5',
      text: '写真部の同級生、潤がカメラを下げて駆けつけた。「式まで、あと三時間。犯人捜し、手伝うよ」――まず、どこから調べよう。',
      next: 'choice_first',
    },
    choice_first: {
      id: 'choice_first',
      text: '手がかりは、部屋の中に残っているはずだ。',
      choices: [
        { label: '窓際の床を調べる', to: 'mud1' },
        { label: '職員室で、鍵の貸出簿を調べる', to: 'key1' },
      ],
    },
    mud1: {
      id: 'mud1', set: ['mud'],
      text: '窓のそばの床に、乾きかけた泥の足跡があった。昨夜は雨。中庭の花壇を通った人間だけが付ける泥だ。',
      next: 'mud2',
    },
    mud2: {
      id: 'mud2',
      text: '窓の鍵（クレセント錠）は、よく見ると半分だけ掛かっている。外から、細い道具で回せる状態だった。',
      next: 'mid1',
    },
    key1: {
      id: 'key1', set: ['key'],
      text: '貸出簿には、昨日の夕方、展示室の合鍵を借りた記録があった。借りたのは美術部。返却の欄は、まだ空欄だった。',
      next: 'key2',
    },
    key2: {
      id: 'key2',
      text: '合鍵が戻っていない。けれど合鍵で入ったのなら、チェーンの説明が付かない。窓か、別の出入り口か――。',
      next: 'mid1',
    },
    mid1: {
      id: 'mid1', bg: 'corridor', se: 'chime',
      text: '放送が流れた。「優勝杯の授与式は、予定通り十二時からです」――ざわつく廊下で、潤が昨日の写真の話をした。',
      next: 'mid2',
    },
    mid2: {
      id: 'mid2',
      speaker: '潤',
      text: '「昨日の夕方、展示の記録写真を撮ったんだ。現像すれば、その時点の優勝杯の状態が分かる。……どうする？」',
      next: 'choice_photo',
    },
    choice_photo: {
      id: 'choice_photo',
      text: '時間は限られている。写真の現像には、三十分かかる。',
      choices: [
        { label: '潤に現像を頼み、その間に聞き込みをする', to: 'photo1' },
        { label: '現像を待たず、実行委員長に話を聞く', to: 'chief1' },
      ],
    },
    photo1: {
      id: 'photo1', set: ['photo'],
      text: '現像された写真を見て、私は息をのんだ。昨日の夕方の時点で、優勝杯の縁はすでにへこんでいた。誰かが隠したのではなく――。',
      next: 'photo2',
    },
    photo2: {
      id: 'photo2',
      text: 'へこんだ杯を、式に出すわけにはいかない。持ち出した人間には「直す」理由があったことになる。そして泥の足跡と、窓の錠。',
      next: 'win1',
    },
    chief1: {
      id: 'chief1',
      speaker: '実行委員長',
      text: '「杯が消えた？　知らないな。夕方、展示室の前で美術部長とすれ違ったが……」――委員長は明らかに慌てていた。隠している顔だ。',
      next: 'chief2',
    },
    chief2: {
      id: 'chief2',
      text: 'けれど、慌てる理由は別にもある。式の進行表が、まだ完成していないのだ。疑うには、まだ早い気がした。',
      next: 'win1',
    },
    win1: {
      id: 'win1', bg: 'trophy',
      text: '展示室に戻る。チェーンの謎を解く鍵は、もう一度この部屋を見ることだと思った。',
      next: 'choice_window',
    },
    choice_window: {
      id: 'choice_window',
      text: '部屋の違和感を、最後に確かめる。',
      choices: [
        { label: '窓とクレセント錠をもう一度確かめる', to: 'win_check1' },
        { label: 'ガラスケースのまわりを確かめる', to: 'win_case1' },
      ],
    },
    win_check1: {
      id: 'win_check1',
      text: 'クレセント錠には、細い傷が付いていた。外から針金のようなもので回した跡だ。犯人は窓から出て、外から錠とチェーンの留め金を操作した――密室の仕掛けが見えた。',
      next: 'last1',
    },
    win_case1: {
      id: 'win_case1',
      text: 'ケースの隅に、小さな金属の粉と、布の繊維が落ちていた。磨き粉と、研磨用の布。誰かが、ここで杯を磨いていたのだ。',
      next: 'last1',
    },
    last1: {
      id: 'last1', se: 'knock',
      text: '昼まで、あと一時間。美術室の前まで来た。美術部長は合鍵を借り、中庭を通る部室棟にいて、金属細工が得意だ。けれど、決め手がなければ、ただの言いがかりになる。',
      next: 'choice_final',
    },
    choice_final: {
      id: 'choice_final',
      text: 'どうする。言うなら、今しかない。',
      choices: [
        { label: '美術部長に、事情を話してもらう', to: 'deny1', toIfFlag: { flag: 'photo', to: 'truth1' } },
        { label: '実行委員長を問い詰める', to: 'wrong1' },
      ],
    },
    truth1: {
      id: 'truth1',
      speaker: '美術部長',
      text: '「……ごめん。へこみに気づいて、夜のうちに直そうと思ったんだ。式に間に合わなくて、朝、慌てて窓から戻ろうとして――」',
      next: 'truth2',
    },
    truth2: {
      id: 'truth2',
      text: '美術室の机の上には、磨き上げられた優勝杯があった。傷もへこみも消えて、昨日の写真より、ずっと輝いている。',
      next: 'end_truth',
    },
    deny1: {
      id: 'deny1',
      speaker: '美術部長',
      text: '「何の話？　証拠もなく人を疑うの？」――決め手のない追求は、すぐに言いくるめられた。時計の針だけが、無情に進んでいく。',
      next: 'end_late',
    },
    wrong1: {
      id: 'wrong1',
      text: '委員長を問い詰めた私に、周りの目が冷たく集まった。「進行表のことで慌てていただけだ」――大事な一時間を、私は間違えた相手に使ってしまった。',
      next: 'end_wrong',
    },
    end_truth: {
      id: 'end_truth', bg: 'trophy', se: 'chime',
      text: '授与式。ステージの優勝杯は、スポットライトを受けて輝いた。事情を知るのは、私と潤と部長だけ。部長の直した小さな傷跡は、優勝したクラスの、新しい歴史の始まりになった。',
      ending: { kind: 'happy', title: 'ハッピーエンド「輝く優勝杯」' },
    },
    end_late: {
      id: 'end_late', bg: 'dark',
      text: '十二時。ステージに優勝杯はなかった。真実は美術室の机の上にあったのに、私の推理は一歩だけ届かなかった。――名探偵への道は、遠かった。',
      ending: { kind: 'bad', title: 'バッドエンド「一歩の差」' },
    },
    end_wrong: {
      id: 'end_wrong', bg: 'corridor',
      text: '式は優勝杯なしで行われた。後で知った真実は、あまりに善意の塊だった。疑うことは、推理の第一歩。けれど人を傷つける推理は、謎解きとは呼ばないのだと学んだ。',
      ending: { kind: 'bad', title: 'バッドエンド「間違えた推理」' },
    },
  },
};
