import { IsNewArchitecture, POSITION_OUT_OF_VIEW } from "@/constants";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { type StateContext, peek$, set$ } from "@/state/state";
import type { InternalState } from "@/types";

export function doInitialAllocateContainers(ctx: StateContext, state: InternalState): boolean | undefined {
    // Allocate containers
    const { scrollLength } = state;
    const data = state.props.data;
    if (scrollLength > 0 && data.length > 0 && !peek$(ctx, "numContainers")) {
        const averageItemSize = state.props.getEstimatedItemSize
            ? state.props.getEstimatedItemSize(0, data[0])
            : state.props.estimatedItemSize;
        const Extra = 1.5; // TODO make it a prop, experiment with whether it's faster with more containers
        const numContainers = Math.ceil(
            ((scrollLength + state.props.scrollBuffer * 2) / averageItemSize!) * state.props.numColumns * Extra,
        );

        for (let i = 0; i < numContainers; i++) {
            set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
            set$(ctx, `containerColumn${i}`, -1);
        }

        set$(ctx, "numContainers", numContainers);
        set$(ctx, "numContainersPooled", numContainers * state.props.initialContainerPoolRatio);

        if (!IsNewArchitecture) {
            if (state.props.initialScroll) {
                requestAnimationFrame(() => {
                    // immediate render causes issues with initial index position
                    calculateItemsInView(ctx, state);
                });
            } else {
                calculateItemsInView(ctx, state);
            }
        }

        return true;
    }
}
