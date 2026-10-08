import type { CreatureKind } from './creatures.js';
import type { ItemId } from './items.js';
import type { RecipeId } from './recipes.js';

/**
 * The story (Phase 13, ADR-026): five chapters, one per great lantern. Data only; the server
 * tracks one shared step for the whole home and the client words it.
 *
 * Premise: the family has moved into grandpa's old cabin at the edge of the Wild. The forest's
 * great lanterns went out one by one, and the night creatures grew bold. On the kitchen table a
 * little lantern called Đốm wakes up and asks for help to light them again.
 */

export type QuestStep =
  /** Talk to Đốm (in the kitchen). */
  | { kind: 'talk'; goal: string; done: string }
  /** Bring things to Đốm: they're taken from your backpack when you talk. */
  | { kind: 'bring'; goal: string; done: string; items: readonly { itemId: ItemId; qty: number }[] }
  /** Find a landmark (discovered by either player). */
  | { kind: 'visit'; goal: string; done: string; landmark: string }
  /** Hunt animals (any kind, or one kind). */
  | { kind: 'hunt'; goal: string; done: string; count: number; creature?: CreatureKind }
  /** Craft something at the workbench or stove. */
  | { kind: 'craft'; goal: string; done: string; recipe: RecipeId }
  /** Have a pet (either player). */
  | { kind: 'tame'; goal: string; done: string }
  /** Light the great lantern at a landmark ([E]). */
  | { kind: 'light'; goal: string; done: string; landmark: string };

export interface ChapterDefinition {
  title: string;
  /** Đốm, when the chapter begins. */
  intro: string;
  steps: readonly QuestStep[];
  /** For the whole home when the chapter ends (each player present gets it). */
  reward: readonly { itemId: ItemId; qty: number }[];
  /** A page of grandpa's journal, readable once the chapter is done (J). */
  journal: string;
}

export const CHAPTERS: readonly ChapterDefinition[] = [
  {
    title: 'Khu Rừng Ngủ Yên',
    intro:
      'Ồ! Xin chào! Tớ là Đốm. Tối nào ông cũng thắp sáng tớ… rồi ông đi xa, và những ngọn đèn lồng lớn tắt dần từng ngọn một. Cậu giúp tớ thắp lại chúng nhé?',
    steps: [
      {
        kind: 'talk',
        goal: 'Nói chuyện với Đốm, chiếc đèn lồng nhỏ trong bếp',
        done: 'Yay! Trước tiên, đèn lồng cần một cái giá và thứ để cháy. Mang cho tớ ít gỗ và nấm nhé.',
      },
      {
        kind: 'bring',
        goal: 'Mang cho Đốm 5 gỗ và 2 nấm',
        done: 'Tuyệt quá! Giờ mình cần ngọn đèn lồng lớn của khu rừng: ở phía bắc, qua khỏi dãy núi, dưới gốc Cây Khổng Lồ.',
        items: [
          { itemId: 'wood', qty: 5 },
          { itemId: 'mushroom', qty: 2 },
        ],
      },
      {
        kind: 'visit',
        goal: 'Tìm Cây Khổng Lồ trong Rừng Sâu (phía bắc)',
        done: 'Cậu tìm thấy rồi! Đèn lồng treo cạnh rễ cây — thắp cho nó chút ánh sáng nào.',
        landmark: 'giant-tree',
      },
      {
        kind: 'light',
        goal: 'Thắp đèn lồng lớn ở Cây Khổng Lồ',
        done: 'Nhìn nó sáng chưa kìa! Thú đêm sẽ không săn cậu khi ở gần đèn đã thắp. Về kể cho tớ nghe nhé!',
        landmark: 'giant-tree',
      },
      {
        kind: 'talk',
        goal: 'Về nhà kể cho Đốm',
        done: 'Một ngọn đèn đã sáng! Tớ tìm thấy một trang nhật ký của ông trong lồng kính — đọc bằng phím [J] nhé.',
      },
    ],
    reward: [
      { itemId: 'cooked_meat', qty: 3 },
      { itemId: 'arrow', qty: 10 },
    ],
    journal:
      'Ngày đầu ở căn nhà gỗ. Khu rừng già và hiền lành, nếu mình hiền với nó. Ông treo một chiếc đèn lồng dưới Cây Khổng Lồ để các con vật nhỏ tìm được đường về ban đêm. — Ông',
  },
  {
    title: 'Tiếng Vọng Đồi Đá',
    intro:
      'Đồi phía đông toàn đá, và heo rừng ở đó khó tính lắm. Đèn lồng lớn nằm trong Hang Tiếng Vọng. Mình phải thật dũng cảm — và có vũ khí tốt nữa!',
    steps: [
      {
        kind: 'craft',
        goal: 'Chế tạo một cây giáo ở bàn chế tạo',
        done: 'Cây giáo đẹp quá! Lũ heo rừng cứ dọa mọi con vật chạy khỏi hang.',
        recipe: 'spear',
      },
      {
        kind: 'hunt',
        goal: 'Săn 2 con heo rừng',
        done: 'Yên ổn hơn rồi. Giờ đi về phía đông, qua con đèo thấp, tới Hang Tiếng Vọng.',
        count: 2,
        creature: 'boar',
      },
      {
        kind: 'visit',
        goal: 'Tìm Hang Tiếng Vọng ở Đồi Đá (phía đông)',
        done: 'Xin chào… chào… chào! Đèn lồng ở ngay bên trong.',
        landmark: 'cave',
      },
      {
        kind: 'light',
        goal: 'Thắp đèn lồng lớn trong Hang Tiếng Vọng',
        done: 'Hai ngọn đèn rồi! Cậu có thấy đêm sáng hơn một chút không?',
        landmark: 'cave',
      },
    ],
    reward: [
      { itemId: 'stone', qty: 6 },
      { itemId: 'snare', qty: 2 },
    ],
    journal:
      'Cái hang hát lại mọi điều mình nói. Ông kể nó nghe một chuyện cười; nó kể lại hai lần. Bà đã viết vài bài hát hay nhất ở đây. — Ông',
  },
  {
    title: 'Người Bạn Bên Hồ',
    intro:
      'Ông hay bảo Hồ Sương Mù cô đơn lắm. Có bạn bên cạnh thì hồ sẽ vui hơn. Cậu có thú cưng chưa? Trứng nằm trong tổ ở xa, còn những bé hoang nhút nhát thì mê món ăn yêu thích của chúng.',
    steps: [
      {
        kind: 'tame',
        goal: 'Có một bạn thú cưng (ấp trứng hoặc làm quen một bé hoang)',
        done: 'Dễ thương quá! Dẫn bạn ấy xuống hồ ở phía nam nhé — khu trại cũ nằm trên bờ.',
      },
      {
        kind: 'visit',
        goal: 'Tìm Trại Bỏ Hoang bên Hồ Sương Mù (phía nam)',
        done: 'Hè nào ông cũng cắm trại ở đây. Đèn lồng treo cạnh lều.',
        landmark: 'camp',
      },
      {
        kind: 'light',
        goal: 'Thắp đèn lồng lớn ở khu trại',
        done: 'Sương tan dần rồi! Ba ngọn đèn!',
        landmark: 'camp',
      },
    ],
    reward: [
      { itemId: 'berries', qty: 8 },
      { itemId: 'pet_egg', qty: 1 },
    ],
    journal:
      'Cả ngày chẳng câu được con cá nào, nhưng một bé ma ngồi cạnh ông bên đống lửa, cùng ông ngắm sao. Chuyến câu cá vui nhất đời. — Ông',
  },
  {
    title: 'Tháp Canh Xưa',
    intro:
      'Phía tây có những tàn tích còn cổ hơn căn nhà gỗ, và một tháp canh cao. Đường đi lạnh lắm, mà sói thì gan dạ. Mặc gì đó cho ấm nhé!',
    steps: [
      {
        kind: 'craft',
        goal: 'Làm áo giáp da ở bàn chế tạo (3 da thú)',
        done: 'Ấm áp ghê! Giờ tới khu tàn tích phía tây nào.',
        recipe: 'leather_armor',
      },
      {
        kind: 'visit',
        goal: 'Tìm Tháp Canh Cũ trong khu tàn tích (phía tây)',
        done: 'Leo lên để nhìn thật xa! Đèn lồng treo dưới sàn tháp.',
        landmark: 'watchtower',
      },
      {
        kind: 'light',
        goal: 'Thắp đèn lồng lớn ở tháp canh',
        done: 'Bốn ngọn! Chỉ còn một — Đền Linh Hồn, nơi trái tim của khu rừng.',
        landmark: 'watchtower',
      },
    ],
    reward: [
      { itemId: 'arrow', qty: 15 },
      { itemId: 'spike_trap', qty: 2 },
    ],
    journal:
      'Từ đỉnh tháp nhìn thấy cả vùng hoang dã: cái hồ, những ngọn đồi, Cây Khổng Lồ, và mái nhà nhỏ của mình. Từ trên này, nhà trông nhỏ xíu và ấm áp. — Ông',
  },
  {
    title: 'Trái Tim Khu Rừng',
    intro:
      'Ngọn đèn cuối cùng ở Đền Linh Hồn, nhưng có một con gấu to canh cái hang cũ ở phía tây bắc. Nó đang sợ, mà gấu sợ thì nguy hiểm lắm. Cẩn thận nhé — đi cùng nhau!',
    steps: [
      {
        kind: 'hunt',
        goal: 'Đối mặt với con gấu trong hang (phía tây bắc)',
        done: 'Cậu dũng cảm quá. Giờ tới ngôi đền — ở phía đông bắc, nơi có luồng sáng vút lên trời.',
        count: 1,
        creature: 'bear',
      },
      {
        kind: 'visit',
        goal: 'Tìm Đền Linh Hồn (phía đông bắc)',
        done: 'Đây là trái tim của khu rừng. Thắp ngọn đèn cuối cùng nào…',
        landmark: 'shrine',
      },
      {
        kind: 'light',
        goal: 'Thắp đèn lồng lớn ở Đền Linh Hồn',
        done: 'ĐỦ CẢ NĂM! Khu rừng sáng rực trở lại! Về nhà đi — tớ có chuyện muốn kể.',
        landmark: 'shrine',
      },
      {
        kind: 'talk',
        goal: 'Về nhà gặp Đốm',
        done: 'Ông sẽ tự hào lắm. Căn nhà gỗ này giờ là nhà của cậu, và khu rừng là bạn của cậu. Cảm ơn nhé! (Câu chuyện đã kết thúc — khu rừng là của cậu để khám phá.)',
      },
    ],
    reward: [
      { itemId: 'bear_coat', qty: 1 },
      { itemId: 'stew', qty: 2 },
    ],
    journal:
      'Nếu cháu đang đọc những dòng này, thì đèn lồng đã sáng lại và căn nhà gỗ đã có một gia đình. Hãy chăm sóc khu rừng, và nó sẽ chăm sóc cháu. Thương cháu nhiều. — Ông',
  },
];

/** Night creatures won't hunt anyone this close to a lit great lantern. */
export const LANTERN_SAFE_RADIUS = 14; // m
/** Where each landmark's great lantern stands (relative to the landmark). */
export const LANTERN_OFFSET = { x: -2.5, z: 2.5 } as const;
export const lanternId = (landmark: string) => `lantern-${landmark}`;

/** The step the home is on, or null when the story is complete. */
export function questStep(chapter: number, step: number): QuestStep | null {
  return CHAPTERS[chapter]?.steps[step] ?? null;
}

/** How many of the step's things count ("3/5"); 1 for one-off steps. */
export function stepTarget(s: QuestStep): number {
  return s.kind === 'hunt' ? s.count : 1;
}

/** What Đốm says at a story position: the chapter's opening, or the line that closed the last step. */
export function domLine(chapter: number, step: number): string {
  if (step > 0) return CHAPTERS[chapter]?.steps[step - 1]?.done ?? '';
  const last = CHAPTERS[chapter - 1]?.steps.at(-1)?.done;
  const intro = CHAPTERS[chapter]?.intro;
  if (!intro) return last ?? ''; // the story is complete
  return last ? `${last}\n\n${intro}` : intro;
}
