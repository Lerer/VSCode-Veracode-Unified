export const getNested = (obj:any, ...args: any[]) => {
    return args.reduce((inQuestion, level) => inQuestion && inQuestion[level], obj);
}
