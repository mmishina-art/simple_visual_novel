// シナリオデータ: 『月夜の図書室』（恋愛もの）
// エンジン（src/logic.ts）とは分けて、作品ごとにこの形式のファイルを1つ置く。
import type { Story } from '../logic';

export const moonLibrary: Story = {
  id: 'moon-library',
  title: '月夜の図書室',
  description: '返却ポストで見つけた、名前のない貸出カード。放課後の図書室で、静かな恋が始まる。',
  length: '5〜10分',
  cover: 'library',
  coverTone: 'light',
  coverObi: 'cream',
  coverLines: ['月夜の', '図書室'],
  coverTitleLayout: 'horizontal',
  bgm: 'romance',
  start: 'start1',
  nodes: {
    start1: {
      id: 'start1', bg: 'library',
      text: '金曜日の放課後。図書委員の当番は、私、森下栞の番だった。夕日の図書室で、返却ポストの本を一冊ずつ棚に戻していく。',
      next: 'start2',
    },
    start2: {
      id: 'start2',
      text: '最後の一冊は、古い詩集だった。ページの間から、貸出カードが滑り落ちた。',
      next: 'start3',
    },
    start3: {
      id: 'start3',
      text: 'カードには、同じ本を何度も借りた記録があった。けれど、借りた人の名前の欄だけが、なぜか空欄だった。',
      next: 'start4',
    },
    start4: {
      id: 'start4',
      text: 'カードの裏に、小さな字で書かれていた。『この詩集の三十二ページが好きです。誰か、気づいてくれますか』',
      next: 'start5',
    },
    start5: {
      id: 'start5',
      text: '三十二ページを開くと、月夜の詩だった。行間に、鉛筆で薄く丸が付けてある。誰かが、確かにここを読んでいた。',
      next: 'choice_note',
    },
    choice_note: {
      id: 'choice_note',
      text: '閉館まで、あと少し。カードを前に、私は迷っていた。',
      choices: [
        { label: 'カードの裏に、鉛筆で返事を書く', to: 'reply1' },
        { label: '何も書かずに、カードを本に戻す', to: 'silent1' },
      ],
    },
    reply1: {
      id: 'reply1', set: ['replied'],
      text: '『気づきました。三十二ページ、私も好きです』――書き終わってから、心臓がうるさく鳴った。名前は書かなかった。',
      next: 'reply2',
    },
    reply2: {
      id: 'reply2', se: 'door',
      text: '詩集を棚に戻し、図書室を出る。誰に届くかもわからない返事が、少しだけ足を軽くした。',
      next: 'week1',
    },
    silent1: {
      id: 'silent1',
      text: '余計なことだ、と思った。カードを挟み直し、詩集を棚に戻す。けれど三十二ページの丸が、頭から離れなかった。',
      next: 'silent2',
    },
    silent2: {
      id: 'silent2', se: 'door',
      text: '図書室を出るとき、一度だけ振り返った。本棚は静かで、何も答えてはくれなかった。',
      next: 'week1',
    },
    week1: {
      id: 'week1', bg: 'library',
      text: '次の金曜日。返却ポストに、あの詩集が戻っていた。先週より、少しだけ早く。',
      next: 'week2',
    },
    week2: {
      id: 'week2',
      text: 'カードの裏。私の字の下に、続きの字があった。『ありがとう。では、五十八ページはどうですか』――声に出して笑ってしまった。',
      next: 'choice_book',
    },
    choice_book: {
      id: 'choice_book',
      text: '五十八ページは、海の詩だった。返事に、何を書こう。',
      choices: [
        { label: '自分の好きな一節を書き添える', to: 'book_talk1' },
        { label: '次に読んでほしい本の題名を書く', to: 'book_rec1' },
      ],
    },
    book_talk1: {
      id: 'book_talk1',
      text: '好きな一節を書き写し、小さく感想を添えた。字のやり取りは、それから毎週続いた。テストの週も、文化祭の週も。',
      next: 'rain1',
    },
    book_rec1: {
      id: 'book_rec1',
      text: '短編集の題名を書くと、翌週、その本が返却ポストに入っていた。やり取りは、それから毎週続いた。テストの週も、文化祭の週も。',
      next: 'rain1',
    },
    rain1: {
      id: 'rain1', bg: 'corridor', se: 'rain',
      text: '十一月の金曜日。放課後に、強い雨が降り出した。閉館間際、濡れた制服の男子が詩集を返しに来た。',
      next: 'rain2',
    },
    rain2: {
      id: 'rain2',
      text: '「すみません、閉館でしたか」――図書委員長の篠宮先輩。三年で、来年の春には卒業する人。',
      next: 'rain3',
    },
    rain3: {
      id: 'rain3',
      text: '受け取った詩集を開くと、貸出カードの名前の欄に、初めて字があった。『篠宮 湊』。カードの裏の字と、同じ字だった。',
      next: 'choice_rain',
    },
    choice_rain: {
      id: 'choice_rain',
      text: '先輩は雨を見上げて、昇降口で立ち尽くしている。私の手には、置き傘が一本。',
      choices: [
        { label: '置き傘を、先輩に差し出す', to: 'lend1' },
        { label: '声をかけられず、そのまま帰る', to: 'pass1' },
      ],
    },
    lend1: {
      id: 'lend1', bg: 'entrance',
      text: '「よかったら」――先輩は驚いて、それから少し笑った。「ありがとう。月曜に、図書室へ返すよ」',
      next: 'lend2',
    },
    lend2: {
      id: 'lend2', bg: 'outside', se: 'rain',
      text: '私は自分の傘で帰った。雨の音の中で、先輩が図書室に傘を返しに来る月曜日のことを考えていた。',
      next: 'last1',
    },
    pass1: {
      id: 'pass1', bg: 'outside', se: 'rain',
      text: '声は出なかった。雨の中を家まで歩きながら、貸出カードのやり取りだけが、私と先輩の全部なのだと思った。',
      next: 'last1',
    },
    last1: {
      id: 'last1', bg: 'library',
      text: '十二月。図書室の掲示に、委員長の交代が貼り出された。篠宮先輩の当番は、次の金曜日が最後になる。',
      next: 'last2',
    },
    last2: {
      id: 'last2',
      text: '返却ポストの詩集。カードの裏に、見慣れた字があった。『金曜の閉館まで、図書室にいます。――湊』',
      next: 'choice_final',
    },
    choice_final: {
      id: 'choice_final',
      text: '最後の金曜日が来た。図書室の鍵を握って、私は立っていた。',
      choices: [
        { label: '図書室で、閉館まで待つ', to: 'wait_alone1', toIfFlag: { flag: 'replied', to: 'meet1' } },
        { label: 'カードに最後の返事を残して、帰る', to: 'letter1' },
      ],
    },
    meet1: {
      id: 'meet1', se: 'door',
      text: '閉館五分前、ドアが開いた。傘を持った先輩が立っていた。「やっぱり、君だったんだ」――先輩は、ずっと前から気づいていた。',
      next: 'meet2',
    },
    meet2: {
      id: 'meet2',
      text: '最初の返事の字が、私の当番表の字と似ていたから、と先輩は照れて笑った。月明かりの図書室で、私たちは初めて、声で話した。',
      next: 'end_happy',
    },
    wait_alone1: {
      id: 'wait_alone1',
      text: '閉館のチャイムが鳴っても、先輩は来なかった。――そうだ。私は一度も返事を書いていない。先輩にとって「誰か」は、最後まで誰でもないままだった。',
      next: 'end_missed',
    },
    letter1: {
      id: 'letter1',
      text: 'カードの裏に、最後の返事を書いた。『楽しかったです。卒業、おめでとうございます』。それで終わりにするはずだった。',
      next: 'end_letter',
    },
    end_happy: {
      id: 'end_happy', bg: 'library',
      text: '春、卒業式の日。先輩から詩集を手渡された。貸出カードには、二人分の字が並んでいた。最後の行に、新しい字。『続きは、また金曜日に』',
      ending: { kind: 'happy', title: 'ハッピーエンド「金曜日の続き」' },
    },
    end_missed: {
      id: 'end_missed', bg: 'dark',
      text: '翌週、詩集は棚に戻っていた。カードの裏に、小さな字が増えていた。『ありがとう。誰かさんへ』――名前のない返事は、名前のないまま終わった。',
      ending: { kind: 'bad', title: 'バッドエンド「誰かさんへ」' },
    },
    end_letter: {
      id: 'end_letter', bg: 'outside',
      text: '卒業式の日、図書室には誰もいなかった。詩集の三十二ページには、今も鉛筆の丸がある。私の恋は、貸出カードの中でだけ、確かに続いていた。',
      ending: { kind: 'bad', title: 'バッドエンド「カードの中の恋」' },
    },
  },
};
