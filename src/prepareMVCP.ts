import { getId } from "./getId";
import { requestAdjust } from "./requestAdjust";
import { type StateContext, peek$ } from "./state";
import type { InternalState } from "./types";

export function prepareMVCP(ctx: StateContext, state: InternalState): () => void {
    const {
        positions,
        scrollingTo,
        props: { maintainVisibleContentPosition },
    } = state;

    let prevPosition: number;
    let targetId: string | undefined;
    let targetIndex: number | undefined;
    const scrollTarget = scrollingTo?.index;

    if (maintainVisibleContentPosition) {
        const indexByKey = state.indexByKey;

        if (scrollTarget !== undefined) {
            // If we're currently scrolling to a target index, do MVCP for its position
            targetId = getId(state, scrollTarget);
            targetIndex = scrollTarget;
        } else if (state.idsInView.length > 0 && peek$(ctx, "containersDidLayout")) {
            // Do MVCP for the first item fully in view
            targetId = state.idsInView.find((id) => indexByKey.get(id) !== undefined);
            targetIndex = indexByKey.get(targetId!);
        }

        if (targetId !== undefined && targetIndex !== undefined) {
            prevPosition = positions.get(targetId)!;
        }
    }

    // Return a function to do MVCP based on the prepared values
    return () => {
        if (targetId !== undefined && prevPosition !== undefined) {
            const newPosition = positions.get(targetId);

            if (newPosition !== undefined) {
                const positionDiff = newPosition - prevPosition;

                if (Math.abs(positionDiff) > 0.1) {
                    requestAdjust(ctx, state, positionDiff);
                }
            }
        }
    };
}
