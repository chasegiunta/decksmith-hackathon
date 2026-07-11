<script setup lang="ts">
import { computed } from "vue";

type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";
type ButtonSize = "compact" | "sm" | "md" | "lg" | "icon";

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    type?: "button" | "submit" | "reset";
  }>(),
  {
    variant: "primary",
    size: "md",
    type: "button",
  },
);

const classes = computed(() => [
  "cursor-pointer items-center justify-center gap-2 font-semibold transition-transform duration-150 ease-snappy active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
  props.variant === "icon" ? "grid" : "inline-flex",
  {
    "bg-accent text-white shadow-[0_8px_20px_rgba(15,124,255,.24)]":
      props.variant === "primary",
    "bg-white text-navy shadow-[0_6px_18px_rgba(0,0,0,.16)]":
      props.variant === "secondary",
    "font-medium text-[#616a77] hover:bg-[#f2f4f7] hover:text-[#252a33]":
      props.variant === "ghost",
    "border border-[#dfe3e9] bg-white text-[#838b98] active:scale-[.95]":
      props.variant === "icon",
    "h-8 rounded-lg px-3 text-[12px]": props.size === "compact",
    "h-9 rounded-xl px-3.5 text-[12px]": props.size === "sm",
    "h-10 rounded-xl px-4 text-[13px]": props.size === "md",
    "h-12 rounded-xl px-5 text-[14px]": props.size === "lg",
    "size-9 rounded-xl p-0": props.size === "icon",
  },
]);
</script>

<template>
  <button :type="type" :class="classes">
    <slot />
  </button>
</template>
