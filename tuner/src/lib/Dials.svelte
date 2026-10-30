<script>
  // One DialKit panel over a component's settings. The config is read once;
  // the parent re-keys this component to rebuild it (another component, or
  // after a reset). Every change is reported as DialKit's nested values.
  import { untrack } from "svelte";
  import { createDialKitController } from "dialkit/svelte";

  let { name, config, onvalues } = $props();
  const dial = untrack(() => createDialKitController(name, config, {}));

  $effect(() => {
    // Serialising reads every value's getter, so this effect tracks them all.
    onvalues(JSON.parse(JSON.stringify(dial.values)));
  });
</script>
