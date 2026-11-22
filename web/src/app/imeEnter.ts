export interface EnterKey {
  key: string;
  isComposing: boolean;
  keyCode: number;
}

const IME_KEY_CODE = 229;

/** 한글 조합을 마치려는 Enter 가 폼 제출로 번지지 않게 한다. */
export const shouldBlockEnter = (e: EnterKey): boolean => e.key === "Enter" && (e.isComposing || e.keyCode === IME_KEY_CODE);
