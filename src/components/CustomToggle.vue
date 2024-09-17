<template>
	<div class="custom-toggle" :class="{ 'enabled': modelValue }" @click="modelValue = !modelValue">
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const $inputEl = ref<HTMLInputElement | null>(null);
const modelValue = defineModel<boolean>();
</script>

<style lang="scss">
.custom-toggle {
	border-radius: var(--toogle-radius);
	width: var(--toggle-width);
	height: calc(var(--toogle-thumb-height) + var(--toogle-border-width) * 2);
	background-color: var(--toggle-bg);
	box-shadow: var(--toggle-box-shadow);
	transition: var(--toggle-transition);
	position: relative;

	&.enabled {
		background-color: var(--accent-bg);
	}

	&::before {
		content: '';
		display: block;
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		right: 0;
		opacity: 0;
	}

	&::after {
		pointer-events: none;
		content: '';
		display: block;
		position: absolute;
		background-color: var(--toggle-thumb-bg);
		width: var(--toggle-thumb-width);
		height: var(--toogle-thumb-height);
		margin: var(--toogle-border-width) 0 0 0;
		border-radius: var(--toggle-thumb-radius);
		transition: transform 0.15s ease-in-out, width 0.1s ease-in-out, left 0.1s ease-in-out;
		left: 0;
		transform: translate3d(var(--toogle-border-width), 0, 0);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
	}

	&.enabled::after {
		transform: translate3d(calc(var(--toggle-width) - var(--toggle-thumb-width) - var(--toogle-border-width)), 0, 0);
	}
}
</style>