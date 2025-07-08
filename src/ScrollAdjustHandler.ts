import { type StateContext, peek$, set$ } from "./state";

export class ScrollAdjustHandler {
    private appliedAdjust = 0;

    private context: StateContext;

    constructor(ctx: any) {
        this.context = ctx;
    }

    requestAdjust(add: number) {
        const oldAdjustTop = peek$(this.context, "scrollAdjust") || 0;

        this.appliedAdjust = add + oldAdjustTop;

        set$(this.context, "scrollAdjust", this.appliedAdjust);
    }
}
