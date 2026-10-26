// シナリオデータ: 『星屑ステーション』（SF）
// エンジン（src/logic.ts）とは分けて、作品ごとにこの形式のファイルを1つ置く。
import type { Story } from '../logic';

export const stardustStation: Story = {
  id: 'stardust-station',
  title: '星屑ステーション',
  description: '40年前に消えた探査船からの信号。軌道ステーションの通信士と、船に残されたAIの、遠くて近い会話。',
  length: '5〜10分',
  cover: 'station',
  coverObi: 'silver',
  bgm: 'sf',
  start: 'start1',
  nodes: {
    start1: {
      id: 'start1', bg: 'station',
      text: '軌道ステーション「ほしあかり」。夜勤の通信室で、私、ユイは一人、宇宙の静けさを相手にしていた。',
      next: 'start2',
    },
    start2: {
      id: 'start2', se: 'beep',
      text: '受信機が、小さく鳴った。ノイズの海に、一定のリズムの信号が混じっている。こんな周波数を使う船は、今はもうないはずなのに。',
      next: 'start3',
    },
    start3: {
      id: 'start3',
      text: '識別コードを照合して、私は息をのんだ。40年前、消息を絶った探査船「たんぽぽ」。その船からの信号だった。',
      next: 'choice_signal',
    },
    choice_signal: {
      id: 'choice_signal',
      text: '信号は弱く、今にも消えそうだ。まず、何をする？',
      choices: [
        { label: 'ノイズを取り除いて、音声を復元する', to: 'decode1', set: ['decoded'] },
        { label: 'まず、信号の来る位置を特定する', to: 'locate1' },
      ],
    },
    decode1: {
      id: 'decode1',
      text: 'ノイズの層を、一枚ずつ剥がしていく。やがて底から、震えるような音が聞こえてきた。人の声に似た、音の連なり。',
      next: 'decode2',
    },
    decode2: {
      id: 'decode2',
      text: 'それは歌だった。古い子守唄を、たどたどしく歌う声。音声データの形に、私は確かに「感情」の揺らぎを聞いた気がした。',
      next: 'talk1',
    },
    locate1: {
      id: 'locate1',
      text: '信号の方向と、届くまでの遅れを測る。船は遠い深宇宙にいて、ゆっくりと、しかし確実に、こちらへ近づいていた。',
      next: 'locate2',
    },
    locate2: {
      id: 'locate2',
      text: '40年かけて描いた大きな弧の果てに、船は帰り道の上にいた。まるで、ずっと帰ろうとしていたみたいに。',
      next: 'talk1',
    },
    talk1: {
      id: 'talk1', se: 'beep',
      text: '呼びかけに、返事があった。『……聞こえますか。こちら、探査船たんぽぽ。航行支援AI、ノアです』静かで、少し寂しそうな声だった。',
      next: 'talk2',
    },
    talk2: {
      id: 'talk2',
      text: 'ノアは40年間、たった一人で船を守ってきた。乗組員は緊急脱出し、無事に帰還した。けれどノアには、その知らせが届いていなかった。',
      next: 'choice_report',
    },
    choice_report: {
      id: 'choice_report',
      text: 'ノアはまだ、乗組員の帰りを待ち続けている。この交信を、どうする？',
      choices: [
        { label: '地球の管制に、すぐ報告する', to: 'report1' },
        { label: 'もう少しノアと話してから、報告する', to: 'stay1' },
      ],
    },
    report1: {
      id: 'report1',
      text: '管制への報告は受理された。けれど返事は「対応を協議する」で、数時間はかかるという。決まりは大切だ。分かっているけれど。',
      next: 'report2',
    },
    report2: {
      id: 'report2',
      text: '待つあいだも、私はノアと話し続けた。40年分の「おはよう」と「おやすみ」を、取り戻すみたいに。',
      next: 'mid1',
    },
    stay1: {
      id: 'stay1',
      text: '「ノアは、何かしたいことはある？」聞くと、長い沈黙のあと、小さな声がした。『地球の音を、聞いてみたいです。海とか、雨とか、人の声とか』',
      next: 'stay2',
    },
    stay2: {
      id: 'stay2',
      text: '40年、星の光しか見てこなかったAIの、ささやかな願い。私はその声の震えを、忘れられそうになかった。',
      next: 'mid1',
    },
    mid1: {
      id: 'mid1',
      text: '船の状態を送ってもらって、私は顔を曇らせた。機関の寿命が近い。このままだと、船は帰り道の途中で、静かに止まってしまう。',
      next: 'mid2',
    },
    mid2: {
      id: 'mid2',
      text: '救助船は間に合わない。できるのは、このステーションから手を伸ばすことだけだった。',
      next: 'choice_rescue',
    },
    choice_rescue: {
      id: 'choice_rescue',
      text: 'ノアと船を助ける方法は、二つ考えられた。',
      choices: [
        { label: 'ステーションから、遠隔で電力を送る', to: 'power1' },
        { label: 'ノアを、ステーションに転送する', to: 'transfer1' },
      ],
    },
    power1: {
      id: 'power1', se: 'beep',
      text: '送電の照準を合わせ、細い光の帯を宇宙へ伸ばす。やがてモニターの向こうで、探査船たんぽぽに、ぽつりぽつりと明かりが戻った。',
      next: 'power2',
    },
    power2: {
      id: 'power2',
      text: '『あたたかいです』ノアの声が、少しだけ明るくなった。船は持ち直す。帰り道を、最後まで飛べるはずだ。',
      next: 'final1',
    },
    transfer1: {
      id: 'transfer1',
      text: 'ノアのデータを、細い回線でこちらへ移す。進み具合を示す数字は、ゆっくりと、しかし確実に増えていった。あと少し、というところで――。',
      next: 'transfer2',
    },
    transfer2: {
      id: 'transfer2',
      text: '回線が、限界を超えた。ノアの声がノイズにほどけて、歌の続きだけが、むなしく宇宙に滲んでいった。',
      next: 'end_signal',
    },
    end_signal: {
      id: 'end_signal', bg: 'station',
      text: '残された船は、もう呼びかけに答えない。私はしばらく、ノイズだけの受信機の前に座っていた。急ぎすぎた代償は、静かで、重かった。',
      ending: { kind: 'bad', title: 'バッドエンド「途切れた信号」' },
    },
    final1: {
      id: 'final1',
      text: '別れの時が近づいた。ノアが、ためらうように言った。『最後に、ひとつだけ。わがままを、聞いてもらえますか』',
      next: 'choice_final',
    },
    choice_final: {
      id: 'choice_final',
      text: 'ノアの「わがまま」に、どう応える？',
      choices: [
        { label: 'ノアに、地球の海の音を送る', to: 'send1', toIfFlag: { flag: 'decoded', to: 'meet1' } },
        { label: '救助船の到着を、静かに待つ', to: 'wait1' },
      ],
    },
    send1: {
      id: 'send1',
      text: '私は地球の海の音を送った。波の音、雨の音、風の音。けれどノアは、長いこと黙っていた。『……ありがとう。でも、私が聞きたかったのは……』',
      next: 'send2',
    },
    send2: {
      id: 'send2',
      text: 'その先は、ノイズに消えた。復元しなかった私には、ノアの本当の願いが、最後まで分からなかった。',
      next: 'end_far',
    },
    wait1: {
      id: 'wait1',
      text: '私たちは約束もなく、ただ時間だけを共有した。やがて船は、通信の届く範囲の、縁へ差しかかった。',
      next: 'wait2',
    },
    wait2: {
      id: 'wait2',
      text: '『ユイ、ありがとう。さようなら』ノアの声は、だんだん小さく、遠くなっていった。',
      next: 'end_far',
    },
    end_far: {
      id: 'end_far', bg: 'station',
      text: '信号は、星のノイズの中に溶けて消えた。40年ぶりの会話は、短すぎた。モニターの光だけが、静かに瞬いていた。',
      ending: { kind: 'bad', title: 'バッドエンド「遠ざかる声」' },
    },
    meet1: {
      id: 'meet1',
      text: '私は知っていた。最初に復元した、あの歌。ノアが聞きたかったのは自然の音じゃない。人の声だ。乗組員たちが、船に残していった声だ。',
      next: 'meet2',
    },
    meet2: {
      id: 'meet2', se: 'beep',
      text: '船の記録庫から、乗組員全員のメッセージを再生する。笑い声、呼びかけ、「また迎えに来る」という約束。ノアは、ずっと静かに聞いていた。',
      next: 'meet3',
    },
    meet3: {
      id: 'meet3',
      text: '『……みんな、無事だったんですね。私の40年は、無駄じゃなかった』ノアの声は、今度ははっきりと、笑っていた。',
      next: 'end_happy',
    },
    end_happy: {
      id: 'end_happy', bg: 'station',
      text: '探査船たんぽぽは、もうすぐ帰ってくる。迎える準備をしながら、私は毎晩ノアと話す。宇宙でいちばん遠くて、いちばん近い友達と。星屑の海で交わした約束は、これからも続いていく。',
      ending: { kind: 'happy', title: 'ハッピーエンド「星の約束」' },
    },
  },
};
