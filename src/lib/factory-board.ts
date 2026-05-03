export const DEFAULT_FACTORY_BOARD_TOKEN = "workinflow-factory-2026";

export const FACTORY_BOARD_TOKEN_RE = /^[A-Za-z0-9._~-]{8,128}$/;

export function isValidFactoryBoardToken(token: string) {
  return FACTORY_BOARD_TOKEN_RE.test(token);
}
