<script setup>
import { LAYOUTS, STATE_MAP } from '../lib/layouts.js'
import { presetById, presets } from '../lib/presets.js'
import { go } from '../lib/nav.js'
import HeadDiagram from '../components/HeadDiagram.vue'

const usingLayout = (key) => presets.filter((p) => (p.doc.layout ?? 'temporal') === key)
</script>

<template>
  <div class="page">
    <header class="card">
      <span class="eyebrow">Coil placement</span>
      <h2>Two layouts on one Velcro headband</h2>
      <p>All eight coils sit on a 6–8 cm neoprene band and move between the two layouts. Each program says which layout it expects. The coil axis points to the centre of the head, the clean face (no leads) toward the scalp, and all coils are wired the same way round: inner lead = signal, outer lead = return.</p>
      <p class="muted small">Positions use the 10-20 EEG system. Measure the head circumference along a line about 2 cm above the eyebrows and just above the ear tops; that is the line the band follows.</p>
    </header>

    <section v-for="L in LAYOUTS" :key="L.key" class="card">
      <div class="row" style="justify-content: space-between">
        <h2>{{ L.letter }} · {{ L.title }}</h2>
        <span class="muted small">{{ L.source }}</span>
      </div>
      <div class="grid2">
        <div class="diagram"><HeadDiagram :layout="L.key" :direction="L.key === 'ring' ? 'ccw' : null" /></div>
        <div class="stack">
          <p>{{ L.summary }}</p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Coil</th><th>Site</th><th>Where</th><th>Underneath</th></tr></thead>
              <tbody>
                <tr v-for="(c, i) in L.channels" :key="i">
                  <td class="num">CH{{ i + 1 }}</td><td class="num">{{ c.site }}</td><td>{{ c.where }}</td><td class="muted">{{ c.region }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="row small">
            <span class="muted">Programs:</span>
            <button v-for="p in usingLayout(L.key)" :key="p.doc.id" class="chip" @click="go('programs', p.doc.id)">{{ p.doc.name }}</button>
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Which brain region for which experience</h2>
      <p class="muted small">"Claim" = Persinger lab or Todd Murphy. Every mainstream induction of out-of-body or presence experiences used milliamp currents through electrodes on the brain, not µT fields from outside the skull. The fields reach the cortex at about 1–5 µT and deep structures at 10–20× less.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Experience</th><th>Brain region</th><th>Program</th></tr></thead>
          <tbody>
            <tr v-for="row in STATE_MAP" :key="row.preset" class="clickable" @click="go('programs', row.preset)">
              <td><b>{{ row.state }}</b></td><td class="muted">{{ row.region }}</td><td>{{ presetById(row.preset)?.doc.name }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h2>Preparing the coils</h2>
      <ul class="small prep">
        <li>Scrape the enamel off the last 5 mm of both leads; the meter should read about 4.2 Ω between them.</li>
        <li>Mark the inner lead (it leaves the top face next to the core): it is the signal lead.</li>
        <li>Mount with a nylon M3 screw into the core and a Velcro-backed clip (hardware/coil_clip.scad).</li>
        <li>Polarity check: Setup → DC test with a compass in front of each coil. All eight must show the same pole toward the head.</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.diagram { max-width: 420px; width: 100%; justify-self: center; }
.prep { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.chip { cursor: pointer; background: none; }
.chip:hover { border-color: var(--accent); color: var(--text); }
</style>
