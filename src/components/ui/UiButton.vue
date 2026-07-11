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
  "cursor-pointer items-center justify-center gap-2 font-medium text-center transition-transform duration-150 ease-snappy active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
  props.variant === "icon" ? "grid" : "inline-flex",
  {
    "bg-linear-to-b bg-accent from-blue-500 via-accent to-blue-700/60 text-white/90 shadow-md text-shadow-sm shadow-blue-950/30 hover:-translate-y-0.5 hover:shadow-lg inset-shadow-xs ring-blue-600 ring inset-shadow-white/30":
      props.variant === "primary",
    "inline-flex gap-x-1 ring-1 whitespace-nowrap font-medium items-center justify-center text-center outline-blue-600 outline-offset-2 focus-visible:outline-2 focus-visible:relative focus-visible:z-10 no-underline select-none active:scale-[.96] transition-transform [.grouped_&]:active:scale-none duration-150 ease-out disabled:cursor-not-allowed disabled:bg-gray-700/5 disabled:inset-shadow-none disabled:ring-gray-700/7 disabled:text-gray-700/50 disabled:shadow-none [&[disabled='true']]:cursor-not-allowed [&[disabled='true']]:bg-gray-700/5 [&[disabled='true']]:inset-shadow-none [&[disabled='true']]:ring-gray-700/7 [&[disabled='true']]:text-gray-700/50 [&[disabled='true']]:shadow-none text-(length:--text-xsm) !rounded-l px-2.5 py-1.25 bg-white shadow-sm ring-gray-400/30 hover:bg-gray-50 text-gray-600 hover:text-gray-700":
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
