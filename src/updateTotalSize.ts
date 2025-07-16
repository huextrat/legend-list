import { getId } from "./getId";
import { getItemSize } from "./getItemSize";
import { type StateContext, set$ } from "./state";
import type { InternalState } from "./types";
import { updateAlignItemsPaddingTop } from "./updateAlignItemsPaddingTop";

export function updateTotalSize(ctx: StateContext, state: InternalState) {
    const {
        positions,
        props: { data },
    } = state;

    if (data.length === 0) {
        addTotalSize(ctx, state, null, 0);
    } else {
        const lastId = getId(state, data.length - 1);
        if (lastId !== undefined) {
            const lastPosition = positions.get(lastId);
            if (lastPosition !== undefined) {
                const lastSize = getItemSize(state, lastId, data.length - 1, data[data.length - 1]);
                // TODO: This is likely incorrect for columns with rows having different heights, need to get max size of the last row
                if (lastSize !== undefined) {
                    const totalSize = lastPosition + lastSize;
                    addTotalSize(ctx, state, null, totalSize);
                }
            }
        }
    }
}

function addTotalSize(ctx: StateContext, state: InternalState, key: string | null, add: number) {
    const { alignItemsAtEnd } = state.props;
    if (key === null) {
        state.totalSize = add;
    } else {
        state.totalSize += add;
    }

    set$(ctx, "totalSize", state.totalSize);

    if (alignItemsAtEnd) {
        updateAlignItemsPaddingTop(ctx, state);
    }
}
