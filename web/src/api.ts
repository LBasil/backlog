export const STATUS_LABELS = {
  to_play: "À jouer",
  playing: "En cours",
  finished: "Terminé",
  dropped: "Abandonné",
} as const;
export type Status = keyof typeof STATUS_LABELS;

export interface Game {
  id: number;
  title: string;
  platform: string | null;
  status: Status;
  rating: number | null;
  hoursPlayed: number;
  coverUrl: string | null;
  notes: string | null;
  finishedAt: string | null;
}
export type GameInput = Partial<Omit<Game, "id">> & { title: string };

export interface GamePage { items: Game[]; total: number; page: number; pageSize: number }
export interface Stats {
  total: number;
  totalHours: number;
  averageRating: number | null;
  byStatus: Record<string, number>;
  byPlatform: Record<string, number>;
  finishedByYear: Record<string, number>;
}
export interface User { id: number; email: string }

export class ApiError extends Error {
  constructor(message: string, public status: number, public details: { path: string; message: string }[] = []) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: "same-origin",
      ...init,
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Réessayez dans un instant.", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Une erreur est survenue", res.status, data.details);
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  register: (email: string, password: string) => request<{ user: User }>("/auth/register", { method: "POST", body: json({ email, password }) }),
  login: (email: string, password: string) => request<{ user: User }>("/auth/login", { method: "POST", body: json({ email, password }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/auth/me"),
  listGames: (params: { status?: string; q?: string; page?: number }) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    return request<GamePage>(`/games?${qs}`);
  },
  createGame: (g: GameInput) => request<Game>("/games", { method: "POST", body: json(g) }),
  updateGame: (id: number, g: Partial<GameInput>) => request<Game>(`/games/${id}`, { method: "PATCH", body: json(g) }),
  deleteGame: (id: number) => request<void>(`/games/${id}`, { method: "DELETE" }),
  stats: () => request<Stats>("/stats"),
};
