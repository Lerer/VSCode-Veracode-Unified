export interface UserPermission {
    name: string,
    id: string,
    description: string,
    types: string[]
}

export interface UserRule {
    id: string,
    name: string,
    description: string,
    permissions?: UserPermission[],
}

export interface User {
    email: string,
    roles: UserRule[],
    id: string,
    name: string, 
}