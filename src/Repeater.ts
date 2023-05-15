export function repeat(f: Function, delayMs: number, times: number) {
    f(0);
    let callCount = 1;
    var repeater = setInterval(function () {
        if (callCount < times) {
            f(callCount);
            callCount += 1;
        } else {
            clearInterval(repeater);
        }
    }, delayMs);
}

export function transition(f: Function, fps: number, totalTime: number) {
    const times = totalTime * fps;
    repeat((callCount) => f((callCount + 1) / times), 1000 / fps, times);
}
