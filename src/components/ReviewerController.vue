<template>
  <div class="reviewer-panel" v-if="app.isReviewing.value">
    <div class="ratings" v-if="app.showAnswerOrNot.value">
      <div class="again button" @click="ratingAs(Rating.Again)"><Frown></Frown>Again</div>
      <div class="hard button" @click="ratingAs(Rating.Hard)"><Meh></Meh>Hard</div>
      <div class="good button" @click="ratingAs(Rating.Good)"><Smile></Smile>Good</div>
      <div class="easy button" @click="ratingAs(Rating.Easy)"><Laugh></Laugh>Easy</div>
    </div>
    <div
      class="show-answer-button button"
      v-if="!app.showAnswerOrNot.value"
      @click="app.showAnswerOrNot.value = true"
    >
      <Eye></Eye>Show answer
    </div>
    <div class="next-button button"><StepForward></StepForward>Next</div>
    <div class="stop-button button" @click="app.stopReviewing"><Square></Square>Stop</div>
  </div>
</template>

<script setup lang="ts">
import { Eye, Frown, Laugh, Meh, Smile, Square, StepForward } from "lucide-vue-next";
import { useAppState } from "@/state/state";
import { type Grade, Rating } from "ts-fsrs";
import { computed, watch } from "vue";

const app = useAppState();

const ratingAs = (rating: Grade) => {
  const curr = app.currReviewingRepeatableId.value;
  if (curr == null) return;
  app.review(curr, rating);
  app.reviewNextIfAvailable();
};
</script>

<style lang="scss">
.reviewer-panel {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99;
  display: flex;
  border-radius: 8px;
  padding: 6px;
  background-color: var(--bg-color-primary);
  box-shadow:
    rgba(43, 41, 0, 0.12) 0px 8px 31px 0px,
    rgba(0, 0, 0, 0.03) 0px 0px 0px 1px;

  .ratings,
  .stop-button,
  .show-answer-button {
    display: flex;

    .again {
      color: var(--again-color);
    }

    .hard {
      color: var(--hard-color);
    }

    .good {
      color: var(--good-color);
    }

    .easy {
      color: var(--easy-color);
    }
  }

  .button {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background-color: hsla(0, 0%, calc(96% - 50%), 0.12);
    }

    svg {
      height: 18px;
      width: 18px;
      margin-right: 4px;
    }
  }

  .stop-button:hover {
    color: var(--dangerous);
  }
}
</style>
