import { checkThreshold } from "./checkThreshold";
import type { StateContext } from "./state";
import type { InternalState } from "./types";

export function checkAtTop(ctx: StateContext, state: InternalState) {
    if (!state) {
        return;
    }
    const {
        scrollLength,
        scroll,
        props: { onStartReachedThreshold },
    } = state;
    const distanceFromTop = scroll;
    state.isAtStart = distanceFromTop <= 0;

    state.isStartReached = checkThreshold(
        distanceFromTop,
        false,
        onStartReachedThreshold! * scrollLength,
        state.isStartReached,
        state.startReachedBlockedByTimer,
        (distance) => state.props.onStartReached?.({ distanceFromStart: distance }),
        (block) => {
            state.startReachedBlockedByTimer = block;
        },
    );
}
