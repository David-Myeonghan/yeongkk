// 개인정보 문의처. 주인이 실제 연락처로 바꾼 뒤 `npm run privacy` 로 문서와 웹 페이지를 다시 만든다.
export const PRIVACY_CONTACT_PLACEHOLDER = "PRIVACY_CONTACT_PLACEHOLDER";

export const PRIVACY_CONTACT = PRIVACY_CONTACT_PLACEHOLDER;

export const isPlaceholderContact = (contact: string): boolean => contact.trim() === "" || contact.trim() === PRIVACY_CONTACT_PLACEHOLDER;
