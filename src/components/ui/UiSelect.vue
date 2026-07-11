<script setup lang="ts" generic="T extends string">
import { computed } from "vue";
import { ChevronDown } from "@lucide/vue";

type SelectSize = "xs" | "sm" | "md";

const props = withDefaults(
  defineProps<{
    options: ReadonlyArray<{ value: T; label: string }>;
    size?: SelectSize;
    surface?: "soft" | "plain";
    ariaLabel?: string;
  }>(),
  {
    size: "md",
    surface: "soft",
    ariaLabel: undefined,
  },
);

const model = defineModel<T>({ required: true });
const selectClasses = computed(() => [
  "w-full appearance-none border border-[#dce1e8] font-normal text-[#262b34] outline-none transition-colors duration-150 focus:border-accent",
  props.surface === "soft" ? "bg-[#fbfcfd]" : "bg-white",
  {
    "h-8 rounded-lg px-2 pr-7 text-[11px]": props.size === "xs",
    "h-10 rounded-lg px-3 pr-8 text-[12px]": props.size === "sm",
    "h-10 rounded-lg px-3 pr-8 text-[12px]": props.size === "md",
  },
]);
const iconClasses = computed(() => [
  "pointer-events-none absolute text-[#9aa2ae]",
  {
    "top-2 right-1.5": props.size === "xs",
    "top-3 right-2.5": props.size === "sm",
    "top-3 right-2.5": props.size === "md",
  },
]);
const iconSize = computed(() => ({ xs: 12, sm: 14, md: 15 })[props.size]);
</script>

<template>
  <span class="relative block">
    <select v-model="model" :class="selectClasses" :aria-label="ariaLabel">
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
    <ChevronDown :class="iconClasses" :size="iconSize" />
  </span>
</template>
