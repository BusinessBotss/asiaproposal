export type UserRole = 'GM' | 'Staff' | 'SuperAdmin';
export interface Restaurant {
    id: string;
    name: string;
    locale: string;
}
export type CommandTarget = 'chef' | 'kitchen' | 'cocinero';
export interface CommandLog {
    id: string;
    restaurantId: string;
    role: UserRole;
    target: CommandTarget;
    message: string;
    status: 'enviado' | 'error' | 'retry';
    errorMessage?: string;
    createdAt: string;
    updatedAt?: string;
}
export declare const ROLE_ORDER: UserRole[];
export declare const COMMAND_SYNONYMS: Record<string, CommandTarget>;
