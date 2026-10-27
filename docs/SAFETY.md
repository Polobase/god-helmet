# Safety

This is an experimental, non-medical device. It is not intended to diagnose, treat or prevent anything.

The first four sections are the rules: exposure, who should not use it, how to use it, and what the hardware and firmware enforce. The rest is the evidence behind them: implants, seizures, the adverse-event record, and what WHO, IARC and ICNIRP say. The app's **Safety** tab shows a short version, and the helmet refuses to start a session until you accept it there.

Evidence words follow the project's scale (see [PRESET_FORMAT.md](PRESET_FORMAT.md)): **established** (independent replication), **single-lab**, **claim** (author or vendor statement), **anecdote**, **unverified**. Field values for this helmet come from the project's model of the cored coil (about 1.8 µT/mA at 20 mm, 105 µT/mA at the coil face; see [CALIBRATION.md](CALIBRATION.md)). They are calculated, not measured. Calibrate your own coils.

## Physical exposure

- **Field.** About 1–8 µT at the cortex (20 mm) and, at the 4.54 mA hardware cap set by the 2.2 kΩ resistors, up to about 0.47 mT at the coil face and about 0.1–0.2 mT on the scalp in front of it (model of the cored coil; calibrate yours). Deep structures (40–50 mm) get about 0.8–1.5 µT at most from one coil.
- **Limits.** [ICNIRP 2010](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgdl.pdf) limits the *induced electric field* (basic restrictions). With the project's coil model and every signal class modelled, the weighted peak stays at least about 400× below the limit for the brain and about 47× below it at the scalp, even at full current, and about 15× below after allowing for several coils in phase and model uncertainty (project calculation, unverified). The 200 µT *reference level* (25–400 Hz) is a screening value for uniform fields; right at the coil face and on the scalp it is exceeded locally at full current by every signal except a slow 7 Hz sine, most of all (about 9× at the scalp) by square and table patterns. ICNIRP allows this for localised sources when the basic restrictions are met. At the usual 1 µT intensity everything is about 8× lower again, but square and table patterns still sit slightly above the reference level at the scalp (about 1.1×).
- **Static fields.** The DC tests in the **Setup** tab (calibration and wiring check) and the DC program drive a constant current, and unipolar pulse or table signals add a steady part. With DC at the full 4.54 mA, the static field is about 0.47 mT at the coil face and 0.2 mT at the scalp. ICNIRP says implanted devices are generally not affected by static fields below 0.5 mT ([ICNIRP 2009](https://www.icnirp.org/cms/upload/publications/ICNIRPstatgdl.pdf)). That is close, so no one with an implant should run DC either.
- **Electrical.** ±10 V maximum, at most 4.5 mA per coil, battery-powered.
  - Always use a **USB power bank** while the helmet is worn. Never use a mains charger or a laptop on mains during a session.
  - **Never** remove the series resistors or connect coils directly to the module.
  - Insulate the coils and leads. ICNIRP's contact-current reference level for the public is 0.5 mA up to 2.5 kHz ([ICNIRP 2010](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgdl.pdf)). A coil channel can drive up to 4.5 mA, so no bare conductor may touch the skin.
- **Heat.** None to speak of: coil dissipation at full current is about 0.1 mW.

## Who should not use it

- **Epilepsy or seizure history**, or a first-degree relative with epilepsy. WHO says people with or predisposed to epilepsy are "likely to be more susceptible" to fields induced in the brain, and links this sensitivity to a family history of seizures and to drugs that lower the seizure threshold ([WHO 2007](https://iris.who.int/handle/10665/43646)). See **Seizures** below.
  - The burst-firing patterns are modelled on seizure EEG, according to Persinger's lab: a thesis says the pattern was extracted from averaged potentials of a human amygdala during complex partial seizures (claim; [Murugan 2013](https://laurentian.scholaris.ca/items/39c9c1ad-70ba-458d-a819-d24c20da217a); see [SIGNALS.md](SIGNALS.md)).
  - Murphy reports a seizure triggered in a seizure-prone person just by left/right attention shifting, with no field at all (anecdote; [Murphy lecture](https://youtu.be/zqrpKUTMXgY?t=4417)).
  - Murphy also reports his own 8–10 days of distress after the bilateral amygdala signal, which he attributes to childhood temporal-lobe epilepsy (anecdote; [Murphy 2006](https://youtu.be/K-0PHkfvEhg?t=2184)).
- **Other seizure risk factors.** A brain lesion (vascular, traumatic, tumour, infection, metabolic), sleep deprivation or alcoholism. These are the TMS guidelines' risk factors ([Rossi 2009](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3260536/)). Murphy also excludes migraine and a "damaged or compromised brain" ([Murphy, safety page](https://www.god-helmet.com/wp/god-helmet/koren_safety.htm)).
- **Psychiatric conditions.** Psychosis/schizophrenia, bipolar disorder, severe depression, PTSD or any other psychiatric diagnosis, or psychiatric medication. Murphy's own rules exclude any psychiatric diagnosis or psychiatric medication ([safety page](https://www.god-helmet.com/wp/god-helmet/koren_safety.htm)). Also any medication that lowers the seizure threshold ([WHO 2007](https://iris.who.int/handle/10665/43646)).
- **Implanted electronics.** Pacemaker, ICD, cochlear or brainstem implant, deep-brain, vagus or spinal-cord stimulator, implanted drug pump. Cochlear implants and brain electrodes are absolute exclusions. See **Implants** below for the reasons and the distances.
  - A **programmable shunt valve** or **metal in the skull**: ask your surgeon first, and never put a coil over it.
- **Pregnancy** or a recent head injury. The TMS guidelines list pregnancy as a condition of increased risk ([Rossi 2009](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3260536/)).
- **Under 18.**
- **Alcohol, cannabis or other drugs** before or during a session.

## How to use it

- Sit or lie down in a quiet, dark room. Keep the **STOP** button in your hand.
- Have a second person present for your first session.
- Take hearing aids out, or switch the telecoil off. A telecoil picks up the signal as hum.
- No magnets anywhere in the headband or coil clips. Use Velcro.
- Stop immediately on fear, anxiety, panic, headache, nausea, dizziness or anything unusual.
  - In the classic preset, phase 1 (right side only) can cause fear. **Skip** jumps to phase 2.
  - If a session felt bad, don't repeat it (Murphy's rule, [safety page](https://www.god-helmet.com/wp/god-helmet/koren_safety.htm)).
- At most **one session per 72 hours**. Murphy's God Helmet page recommends at most once a week, and a 21-day break after six sessions ([safety page](https://www.god-helmet.com/wp/god-helmet/koren_safety.htm)). The app warns if it has been less than 72 h.
- No driving or machinery for at least one hour afterwards.
- Don't combine with other stimulation devices (light/sound machines, CES, TENS, magnets) during a session.
- Write anything unpleasant into the session notes in the **Log** tab, including in the following week. Murphy describes delayed irritability on days 4–7 (claim; see **Adverse-event record**).
- To find out whether a symptom depends on the field, tick **Blind** in the **Programs** tab ([EXPERIMENTS.md](EXPERIMENTS.md)).
- Sessions are capped at 60 minutes by the firmware.

## Built-in safeguards

| Safeguard | What it does |
|---|---|
| Series resistors | Hardware current limit of 4.54 mA per coil (±10 V through 2.2 kΩ). No setting in the firmware or the app can exceed it |
| Arming switch (PhotoMOS) | Coil return stays open at power-up until the DAC is at 0 V, and closes only when a session starts. Opens on STOP, at session end and on any reset (a 10 kΩ pull-down holds it open while the ESP32 restarts) |
| STOP button | Hardware interrupt that cuts the coil return instantly, independent of Bluetooth and the app. No fade |
| Field ceiling | User ceiling (default 5 µT, at most 10 µT at 20 mm) clamps every program; DC tests limited to 4.6 mA and 120 s (the resistors cap the current at 4.54 mA anyway) |
| Fades | 10 s fade-in/out unless a program sets its own; tests use 0.5 s. A stop from the app, or a lost keepalive, fades out over 2 s |
| Watchdog | The real-time task is supervised by the ESP32 task watchdog; a hang of more than about 5 s resets the ESP32, which opens the arming switch |
| Session cap | 60 min per session; the firmware rejects longer programs |
| Optional app keepalive | Stops the session if no app has been connected for a set time (**Setup** → Helmet) |
| Safety gate | The helmet refuses to start sessions and tests until the safety page has been accepted in the app |
| Interval warning | The app asks you to press Start twice if the last session was less than 72 h ago (needs the helmet clock, which the app sets) |

## Implants

### Why the exposure limits don't settle it

Exposure guidelines protect tissue, not devices. ICNIRP names pacemakers, defibrillators and cochlear implants and says: "Interference with pacemakers may occur at levels below the recommended reference levels" ([ICNIRP 2010](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgdl.pdf)). The UK Health and Safety Executive suggests limiting workers with active implants to the public limits and refers to BS EN 50527 ([HSE 2016](https://www.hse.gov.uk/pubns/priced/hsg281.pdf)). The US FDA names ISO 14117 (cardiac devices) and the ISO 14708 series as the standards often used for the EMC of active implants ([FDA 2022](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/electromagnetic-compatibility-emc-medical-devices)).

So the question for each implant is how strong the field is where the implant sits.

### How fast the field falls off

One coil, on its axis, from the project's coil model:

| Distance from the coil face | At the 4.54 mA cap | At a 1 µT program | Compared with the hearing-loop reference (0.50 µT), at the cap |
|---|---|---|---|
| 0 mm (coil face) | 470 µT | 56 µT | +60 dB |
| 3 mm (scalp) | 200 µT | 24 µT | +52 dB |
| 10 mm | 37 µT | 4.4 µT | +37 dB |
| 20 mm (cortex) | 8 µT | 1 µT | +24 dB |
| 50 mm | 0.8 µT | 0.1 µT | +4 dB |
| 100 mm | 0.12 µT | 0.014 µT | −12 dB |
| 200 mm | 0.016 µT | 0.002 µT | −30 dB |
| 300 mm | 0.005 µT | 0.0006 µT | −40 dB |

Beyond a few centimetres the field falls roughly with the cube of the distance. Head implants can sit right under a coil, where the field at full current is tens to hundreds of microtesla, and still a few microtesla 2–3 cm away. Chest implants sit 20–30 cm away. Even with all eight coils in phase at full current, the field there is at most about 0.13 µT at 20 cm and 0.04 µT at 30 cm. Typical homes average about 0.07 µT (Europe) and 0.11 µT (North America) ([WHO 2007, Fact Sheet 322](https://www.bpa.gov/-/media/Aep/lands/EMF_WHO_EMF-Fact-Sheet-2007a1.pdf)).

### Summary

| Implant | Project rule | Main reason |
|---|---|---|
| Cochlear or auditory brainstem implant | Never | Magnet, receiver coil and chip under the scalp near the coil sites; named first in the TMS guidelines' only absolute contraindication (metal hardware close to the coil) |
| Deep-brain stimulator, other brain electrodes | Never | Leads under the scalp can pick up induced voltage; no clearance data |
| Pacemaker, ICD, CRT device | Do not use. If a cardiologist clears you anyway: coils on the head only, all electronics at least 15 cm from the device | Field at the chest is tiny, but unipolar sensing is a known weak point and nobody has tested these coils |
| Vagus-nerve or spinal-cord stimulator | Do not use. With a neurologist's consent: electronics at least 20 cm from the generator, no low coils on the implanted side | The VNS lead runs up the neck |
| Programmable shunt valve | Ask your neurosurgeon; never a coil over the valve | Static fields of tens of mT change settings |
| Hearing aid or processor with a telecoil | Take it out or switch the telecoil off | Loud hum; not a tissue hazard |
| Insulin pump, CGM | Keep pump, controller and phone away from the coil harness | Body-worn; nanotesla fields at that distance |

### Cardiac devices

- **The standard.** ISO 14117 tests pacemakers, ICDs and CRT devices from 16.6 Hz to 1 kHz with a continuous sine injected into the lead ([Seckler 2015](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4483677/)). Its sensing limits rise linearly from 3 kHz to 167 kHz: 9–500 mV for unipolar and 0.9–50 mV for bipolar leads ([Driessen 2019](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6365808/)). The limits below 3 kHz, where this helmet works, could not be checked (unverified). A secondary source says ISO 14117:2019 expects cardiac devices to be unaffected by static fields up to 1 mT ([Saha 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9919430/); the standard itself was not read).
- **Patient studies.** In 245 pacemaker patients exposed to 50 Hz at 100 µT, 3 devices with unipolar sensing switched to asynchronous mode and 1 caused symptomatic inhibition; bipolar sensing was unaffected ([Trigano 2005](https://pubmed.ncbi.nlm.nih.gov/15766826/)). No bipolar pacemaker or ICD showed interference at 2–200 Hz up to 300 µT, but 3 unipolar pacemakers did at the highest fields ([Tiikkaja 2013](https://pubmed.ncbi.nlm.nih.gov/23125355/)). 83% of 110 ICDs at nominal sensitivity were unaffected by 50 Hz fields up to 2.55 mT ([Napp 2014](https://pubmed.ncbi.nlm.nih.gov/24163067/)). Three independent groups agree: bipolar devices tolerate low-frequency fields far above this helmet's, and unipolar sensing is the weak point (established).
- **Waveform.** In the lab, 6 of 16 pacemakers malfunctioned at 2–1000 Hz, and "some frequencies using ramp or square waveforms" interfered even below public exposure limits ([Tiikkaja 2012](https://pubmed.ncbi.nlm.nih.gov/22231158/)). No ICD was disturbed below the public limits ([Tiikkaja 2012, ICDs](https://pubmed.ncbi.nlm.nih.gov/22834765/)). This helmet plays square pulses and stepped (2 kHz staircase) signals, and point tables can hold any shape.
- **Distance guidance.** Medtronic says to keep magnets, speakers and "Magnetic Therapy Products" at least 15 cm (6 in) from the device ([Medtronic EMC guide](https://www.medtronic.com/en-us/l/patients/electromagnetic-guide/household-hobby.html)). The FDA gives the same 15 cm for phones and watches with magnets ([FDA 2021](https://www.fda.gov/radiation-emitting-products/cell-phones/magnets-cell-phones-and-smart-watches-may-affect-pacemakers-and-other-implanted-medical-devices)).
- **This helmet.** At most about 0.13 µT at 20 cm with all eight coils in phase at full current. That is about 1/2,000 of the 300 µT that left bipolar devices undisturbed.

### Brain and nerve stimulators

- **Deep-brain stimulators.** Ex vivo, TMS pulses 2–10 cm from a DBS generator made it malfunction, and closer than 2 cm damaged it permanently ([Rossi 2009](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3260536/), citing [Kumar 1999](https://pubmed.ncbi.nlm.nih.gov/9918361/)). TMS induces voltages in the electrode wires "whether the implant is turned ON or OFF". TMS over a lead can also shut the generator off ([Rossi 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9094636/)). This helmet is about a million times weaker than TMS ([Granqvist 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/)), but a coil can sit right over a lead under the scalp. A rough estimate puts the voltage induced in a wire loop under a coil at about 0.2–1 µV at 10 Hz, rising to about 10–45 µV at 500 Hz. That is the size of the brain signals that sensing stimulators record (inference, unverified). No clearance data exist.
- **Vagus-nerve stimulators.** LivaNova tells patients to keep devices "with a strong static or pulsing magnetic field" at least 20 cm (8 in) from the chest ([LivaNova](https://www.livanova.com/epilepsy-vnstherapy/en-us/safety-information)). The TMS guidelines consider figure-8 TMS safe with pacemakers, VNS and spinal-cord stimulators if the coil is not fired within 10 cm of the generator in the neck or torso ([Rossi 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9094636/)). The helmet field at the chest is below 0.2 µT. The remaining concern is the lead in the left side of the neck, so a cleared user should leave out the lowest sites on that side (TP7, P7, mastoid).
- **Other active implants.** HSE lists neurostimulators, retinal implants and implanted drug pumps as active implants ([HSE 2016](https://www.hse.gov.uk/pubns/priced/hsg281.pdf)). The TMS guidelines name medication pumps among the hardware that is an absolute contraindication when in close contact with the coil ([Rossi 2009](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3260536/)). Treat one in the body like a cardiac device. Exclude one in the head.

### Cochlear implants and hearing aids

- **Cochlear and auditory brainstem implants.** "The only absolute contraindication to TMS/rTMS is the presence of metallic hardware in close contact to the discharging coil (such as cochlear implants, or an Internal Pulse Generator or medication pumps)" ([Rossi 2009](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3260536/)). A TMS pulse can induce high voltages in the implant's loop antenna, move or demagnetise its magnet, and damage its chip. Rossi 2021 says TMS "may be unsafe based on physics considerations", and that strong static magnets can also affect implants that contain magnets ([Rossi 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9094636/)). This helmet's AC field is far weaker than TMS, but three things remain:
  - the coil core is ferrite or iron, so the implant magnet will attract it (inference, unverified);
  - the temporal 4+4 layout puts coils at TP7/TP8 and CP5/CP6, behind and above the ear, where these implants sit (inference, not checked against manufacturer drawings; see [PLACEMENT.md](PLACEMENT.md));
  - a DC program at full current reaches about 0.47 mT at the coil face.

  Manufacturer EMI manuals were not retrieved.
- **Telecoils.** Hearing-loop systems are assessed under IEC 60118-4 ([IEC](https://webstore.iec.ch/publication/798)) against a reference of 400 mA/m, about 0.50 µT. That figure comes from a meter vendor's specification ([Ampetronic](https://www.ampetronic.com/products/loopworks-measure-receiver-field-strength-meter-r2/)); the standard itself was not read. At full current the helmet exceeds that by about 24 dB at 20 mm and 60 dB at the coil face. At a 1 µT program it is still about 6 dB above it at 20 mm. A telecoil near a coil reproduces the signal as hum. This is a comfort and loudness issue, not a tissue hazard. No published hum threshold for hearing processors was found.

### Shunt valves, pumps and magnets

- **Programmable shunt valves.** In the lab, settings changed from 24 mT (Sophy), 30 mT (Strata) and 42 mT (Codman Hakim); ProGAV and Polaris valves were immune up to 3 T ([Lavinio 2008](https://pubmed.ncbi.nlm.nih.gov/18759607/)). A tablet computer with its cover (17 mT) changed 58% of settings at under 1 cm and 5% at 1–2.5 cm; the bare tablet (7.6 mT) changed 67% at under 1 cm ([Strahle 2012](https://pubmed.ncbi.nlm.nih.gov/22734456/)). In one case report, electromagnetic door locks changed a Codman Hakim setting ([Licht 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9566978/)). Most of the helmet's signals swing both ways and average zero; DC and unipolar signals add a steady part. Either way the field never exceeds about 0.47 mT at the coil face: about 16× below the bare tablet's 7.6 mT and about 50× below the lowest laboratory threshold (24 mT).
- **Insulin pumps and CGMs.** Omnipod says its pod and controller "may be affected by strong radiation or magnetic fields" ([Omnipod](https://www.omnipod.com/safety)). HSE lists pumps and CGMs as body-worn devices ([HSE 2016](https://www.hse.gov.uk/pubns/priced/hsg281.pdf)). At body distances the helmet field is in the nanotesla range.
- **Magnets.** HSE flags equipment producing static fields above 0.5 mT as a risk for people with active implants, and sets 3 mT for ferromagnetic passive implants ([HSE 2016](https://www.hse.gov.uk/pubns/priced/hsg281.pdf)). Keep permanent magnets out of the build.

## Seizures

### What the physics says

A field can trigger a seizure through a known mechanism only if it induces an electric field in the brain strong enough to excite neurons. This helmet's induced field is far below that.

| Exposure | Electric field induced in the brain | Source |
|---|---|---|
| TMS pulse | about 500 V/m | [WHO 2007](https://iris.who.int/handle/10665/43646), citing Walsh & Cowey |
| Nerve stimulation threshold | of the order of 20 V/m | [WHO 2007](https://iris.who.int/handle/10665/43646), citing Reilly |
| Low-field magnetic stimulation (clinical) | below 1 V/m | [Rohan 2014](https://pubmed.ncbi.nlm.nih.gov/24331545/) |
| Effect on neural networks in vitro (one study) | 0.14 V/m rms, as pulses about 26 ms wide | [Francis 2003](https://pubmed.ncbi.nlm.nih.gov/12917358/) |
| ICNIRP public limit, brain, 10–25 Hz | 0.01 V/m rms | [ICNIRP 2010](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgdl.pdf) |
| This helmet, 7 Hz sine, full current, 20 mm | about 0.0000017 V/m | project calculation (unverified) |
| This helmet, edges of square or stepped signals, full current, 20 mm | about 0.011 V/m, for 2–7 µs | project calculation (unverified) |

The ICNIRP weighted-peak method accounts for how short the edge spikes are. On that basis the brain stays at least about 400× below the public limit at full current (see **Physical exposure**). Triggering a seizure by direct depolarisation is therefore implausible on physical grounds. This argument does not test Persinger's claim that weak fields act through their timing pattern rather than their strength (claim).

### The TMS guidelines as an upper bound

TMS induces fields about a million times stronger than this helmet ([Granqvist 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/)). Its safety guidelines are therefore a generous upper bound for direct effects.

- **Risk factors** ([Rossi 2009](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3260536/)): personal history of epilepsy; vascular, traumatic, tumour, infectious or metabolic brain lesions; drugs that lower the seizure threshold; sleep deprivation; alcoholism. "Any novel paradigm", including stimulation of more than one scalp region, carries uncertain risk. By that definition every program on this helmet is a novel paradigm.
- **Other events:** implanted brain electrodes, pregnancy and severe or recent heart disease carry increased risk.
- **Family history.** First-degree relatives of people with epilepsy have an increased risk, but no TMS seizures have been described in them. For TMS this calls for precautions, not exclusion ([Rossi 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9094636/)). This project excludes them anyway, following WHO's family-history point.
- **Low-field stimulation.** Rossi 2021 defines low-field magnetic stimulation as fields generally below 10% of the neural activation threshold, and reports that those studies "reported no AEs".

TMS seizures per 100,000 sessions ([Rossi 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9094636/), citing [Lerner 2019](https://pubmed.ncbi.nlm.nih.gov/31104898/)):

| Group | Single, paired or ≤ 1 Hz TMS | rTMS above 1 Hz |
|---|---|---|
| No risk factors | 2 | 1 |
| All sessions | 8 | 7 |
| High-risk subjects | 27 | 67 |

### Weak-field findings

| Finding | Exposure | Evidence |
|---|---|---|
| One man: "rushes of fear", an apparition, and 1–2 s paroxysmal 15 Hz spikes on EEG (not a seizure) ([Persinger 2000](https://pubmed.ncbi.nlm.nih.gov/10833767/)). Paroxysmal 4–5 Hz activity over the temporal lobes also occurred during a spontaneous sensed presence with no field, in a patient after a mild head injury ([Persinger & Tiller 2008](https://pubmed.ncbi.nlm.nih.gov/18821169/)) | 1 µT frequency-modulated pattern, right hemisphere | single-lab, n = 1 |
| More frequent severe (Racine level-5) seizures in 24 rats with limbic epilepsy, most clearly with the Thomas pattern at 3 ms points; repeated in the same lab against sham (n = 9) ([Persinger & Belanger-Chellew 1999](https://pubmed.ncbi.nlm.nih.gov/10597585/)) | about 1 µT | single-lab |
| Seizures in epileptic rats rose 3.1-fold after one or two (but not three) nights of fields mimicking geomagnetic activity ([Persinger 1996](https://pubmed.ncbi.nlm.nih.gov/8884398/)). A constant 700 nT field appeared to inhibit them; hourly 15–20 nT steps up to 70 nT increased them ([Michon 1996](https://pubmed.ncbi.nlm.nih.gov/8724937/)) | 15–700 nT, overnight | single-lab |
| 76% post-seizure mortality in rat pups exposed around birth; weaker and stronger fields did not do this ([St-Pierre 2007](https://pubmed.ncbi.nlm.nih.gov/17961603/)) | 7 Hz, about 5 nT | single-lab |
| Sleep spindles entrained in one woman with epilepsy after head injury; the authors suggest "epilepsy spectrum" states may be more sensitive ([Persinger 2009](https://pubmed.ncbi.nlm.nih.gov/20017628/)) | 1 µT burst, 0.7 s every 3 s | single-lab, n = 1 |
| Epileptiform activity evoked in 6 presurgical epilepsy patients ([Fuller 1995](https://pubmed.ncbi.nlm.nih.gov/7895093/)); enhanced in 2 of 3 and stopped in 1 ([Dobson 2000](https://pubmed.ncbi.nlm.nih.gov/10653619/)) | static 0.9–1.8 mT | single-lab |

Two of these bear directly on this helmet:

- **Thomas pattern.** The `thomas` signal type plays a decelerating sweep at 3 ms points by default, and many Thomas-pattern programs, such as `thomas-pulse`, replay the patent table at 3 ms per point ([PRESET_FORMAT.md](PRESET_FORMAT.md)). That is the point duration the 1999 rat study flagged.
- **DC.** At full current the static field of a DC program at the coil face (0.47 mT) is only 2–4× below the Fuller fields, and 4–9× below at the scalp. At the cortex it is more than 100× below.

No published human seizure case linked to a microtesla patterned-field device was found. The search was limited, so this is not proof of absence (unverified).

### What the vendor says

Murphy's safety page states: "These signals can not cause lesions, DNA damage, induce seizures, or any other kind of neural damage" (claim; [Murphy, safety page](https://www.god-helmet.com/wp/god-helmet/koren_safety.htm)). The same page excludes people with epilepsy. Persinger's own rat papers (above) report seizure facilitation and higher post-seizure mortality at nanotesla to microtesla levels. The "cannot induce seizures" claim is not supported for susceptible brains.

## Adverse-event record

There is no adverse-event registry and no systematic follow-up of commercial Shakti or Shiva users. Persinger-lab human trials report effects, not adverse-event rates. Their abstracts give none, including a re-analysis of 407 subjects in 19 experiments ([St-Pierre & Persinger 2006](https://pubmed.ncbi.nlm.nih.gov/16861170/)). That is a gap in the record, not evidence of safety.

### Vendor reports

| Report | How often | Evidence |
|---|---|---|
| Headaches, felt as pressure rather than pain, mostly with the hippocampal signal; the advised fix is to lower the intensity by a third ([consumer information](https://www.god-helmet.com/wp/god-helmet/koren_infomed_consent.htm)) | "approximately 2%" with "a previous version" of the technology; no denominator | claim |
| "Metabolic snapback": bursts of irritability or anxiety ([two ways page](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/two_ways.htm)), mostly on days 4–7 after a session and in weeks 2 and 5 of a weekly series; not reported after single sessions ([Shakti intro](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/intro_page.htm)) | "Most people don't feel it at all" ([snapback page](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/snapback.htm)); under 10%, not reported with 3-day schedules ([8-coil Shakti page](https://www.god-helmet.com/wp/winshakti/rotating/rot_snapback.htm)) | claim |
| One "unpleasant episode" with sessions every two days ([how often](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/how_often_is_safe.htm)) | one subject | anecdote |
| "Unpleasant effects" when combined with light or sound machines ([Shiva safety](https://www.god-helmet.com/wp/shiva/shiva_demo/shiva_safety.htm)) | not given | claim |
| Fear in phase 1 of the classic session: "a large number of people do have an unpleasant experience" ([Murphy 2006](https://youtu.be/K-0PHkfvEhg?t=95)) | not given | claim |
| 64-coil Shiva, one 27-year-old student, 5 min of an amygdala burst pattern: anxiety and nausea, thought of asking to stop, then tiredness and headache ([PRLog 2012](https://www.prlog.org/11844110-god-helmet-inventor-induces-out-of-body-experience-in-under-six-minutes-using-quiet-magnetic-fields.html)) | n = 1, known only from a press release | anecdote |
| "Hundreds of people have used home versions of Shakti without ill-effects" ([safety page](https://www.god-helmet.com/wp/god-helmet/koren_safety.htm)) | no registry | anecdote |

### Murphy's own episode

In 1998 Murphy ran "too many sessions in too short a period of time" with the amygdala signal over both sides. He describes "an almost psychotic state", anxious and depressed, for about eight or ten days. He attributes it to childhood right temporal-lobe epilepsy. He also names a romantic disappointment at the same time. Moving the signal to the left side only ended the problem ([Murphy 2006](https://youtu.be/K-0PHkfvEhg?t=2184)). This is a single retrospective self-report (anecdote).

### Persinger-lab findings

These come from the lab that developed the method. They cut against "cannot cause harm".

| Finding | Exposure | Evidence |
|---|---|---|
| Women, but not men, reported more apprehension ([Richards 1992](https://pubmed.ncbi.nlm.nih.gov/1408634/)) | burst-firing over the right temporal lobe | single-lab |
| More "presences, fears, and odd smells" with right or bilateral stimulation than with left or sham (N = 48, double-blind) ([Persinger & Healey 2002](https://pubmed.ncbi.nlm.nih.gov/12193838/)) | 100 nT–1 µT, 20 min | single-lab |
| Increased aggression and decreased trust compared with a pulsed field or control ([Gillis & Persinger 1993](https://pubmed.ncbi.nlm.nih.gov/8451123/)) | three weekly 20-min sessions of bilateral burst-firing | single-lab |
| A marked rise in hypnotic suggestibility, only with right-hemisphere stimulation (eta 0.58) ([Healey 1996](https://pubmed.ncbi.nlm.nih.gov/9003980/)). A 40 Hz field phase-modulated at 5 Hz did not raise it ([Sculthorpe & Persinger 2003](https://pubmed.ncbi.nlm.nih.gov/15002842/)) | 1 µT burst-firing, 20 min, right temporoparietal | single-lab |
| Compared with 50 Hz or sham, the burst-firing and 25 Hz groups accepted about twice the number of false statements as true (N = 50) ([Ross 2008](https://pubmed.ncbi.nlm.nih.gov/19037785/)) | 1 s at 1–10 µT over the left prefrontal region, during refutation | single-lab |
| Women reported more fear; one sequence (bilateral hippocampal, then left amygdala) gave more anger. 24 participants, 3 per condition, no sham ([Collins 2013](https://laurentian.scholaris.ca/server/api/core/bitstreams/c03e0259-4b31-410f-9552-d90c9c2b81a4/content)) | Shiva, 4+4 temporal coils, 2 × 20 min | single-lab |
| Prenatal rats: "conspicuous anomalous organizations of cells within the hippocampal formation" ([St-Pierre & Persinger 2003](https://pubmed.ncbi.nlm.nih.gov/15002875/)) | complex sequenced field, 30–180 nT | single-lab |
| Prenatal rats: raised blood markers (aminotransaminase, glucose, uric acid) and more hippocampal cell anomalies ([St-Pierre 2008](https://pubmed.ncbi.nlm.nih.gov/18386197/)) | 30–580 nT | single-lab |

None of these has been independently replicated. The lab also reported that weekly burst-firing improved mood and vigour ([Tsang 2009](https://pubmed.ncbi.nlm.nih.gov/20017627/)), so its own results conflict. The vendor cannot have it both ways. If the lab's positive results are real, these adverse ones count too. If they are not, the independent null result ([Granqvist 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/)) applies to the benefits as well. See [RESEARCH.md](RESEARCH.md) for the replication record.

### Clinical low-field devices

Clinical devices with stronger induced fields than this helmet report few side effects. A double-blind trial of a 7-coil pulsed-field helmet over 5 weeks found "Treatment-emergent side effects were few and mild" ([Martiny 2010](https://pubmed.ncbi.nlm.nih.gov/20385376/); single-lab). Low-field magnetic stimulation studies "reported no AEs" ([Rossi 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9094636/)). For comparison, headache occurs in about 28% with active rTMS and 16% with sham (Loo 2008, cited by [Rossi 2009](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3260536/)).

### What happens with no field at all

Darkness, isolation and expectation cause many of the same symptoms.

- In a 50-minute "haunted room" study (N = 79), 79.7% felt dizzy or odd and 8.9% felt terror. The number of unusual experiences was unrelated to whether the field or the infrasound was on ([French 2009](https://pubmed.ncbi.nlm.nih.gov/18635163/); single-lab).
- With a sham helmet that was never switched on (193 completers), roughly 12.5% of participants mentioned dizziness and 16.1% stress or a raised heart rate ([Maij 2019](https://doi.org/10.1080/2153599X.2017.1403952); single-lab).
- A review of 46 blind or double-blind provocation studies (1,175 volunteers) found "No robust evidence" that fields trigger symptoms in people who report sensitivity, and supported a nocebo effect ([Rubin 2010](https://pubmed.ncbi.nlm.nih.gov/19681059/); established).

The **Blind** option in the **Programs** tab tests this for you: the helmet picks real or sham and reveals it only after you rate the session ([EXPERIMENTS.md](EXPERIMENTS.md)).

### Running sessions on other people

ICNIRP's public limits exclude "medical exposure", which includes volunteers in medical research ([ICNIRP 2010](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgdl.pdf)). IEEE C95.1-2019 says its limits are not intended for patients or informed research volunteers ([IEEE 2019](https://w.mriquestions.com/uploads/3/4/5/7/34572113/ieee_standards_08910342.pdf)). Neither set of limits was written for experiments on people. If you run sessions on anyone else:

- get informed consent in writing before the session;
- screen them against **Who should not use it**;
- keep a second person present and the STOP button within reach;
- seek independent ethics review for any study.

The suggestibility and false-statement results above are single-lab, but they are a reason never to expose anyone without their knowledge. See [EXPERIMENTS.md](EXPERIMENTS.md) and [QUESTIONNAIRES.md](QUESTIONNAIRES.md).

## What WHO, IARC and ICNIRP say

### WHO: Environmental Health Criteria 238 (2007)

A WHO Task Group reviewed fields from 0 to 100 kHz in 2005; WHO published the result as EHC 238 in 2007 ([WHO 2007](https://iris.who.int/handle/10665/43646)). In plain terms:

- **Short-term effects are real, at high levels.** They are nerve stimulation and faint flickering visual sensations (magnetic phosphenes); phosphenes need above about 5 mT at 20 Hz across the head. Following the ICNIRP or IEEE guidelines "provides adequate protection for acute effects". WHO's fact sheet places established acute effects at "high levels (well above 100 µT)" ([WHO 2007, Fact Sheet 322](https://www.bpa.gov/-/media/Aep/lands/EMF_WHO_EMF-Fact-Sheet-2007a1.pdf)). This helmet exceeds 100 µT only within about 5 mm of a coil face, and only at settings above about 1.8 µT (at 20 mm).
- **Brain activity, sleep and mood:** "subtle and transitory effects at best". Single positive findings exist: disturbed sleep with 1 µT overnight and with 28 µT applied intermittently, and more positive mood at 20 Hz, 50 µT. On sleep, WHO says further studies are needed "before any conclusions can be drawn". Waking-EEG studies gave "inconsistent and sometimes contradictory results".
- **Hypersensitivity:** "neither healthy volunteers nor self-reporting hypersensitive individuals can reliably distinguish field exposure from sham-exposure".
- **Epilepsy:** people with or predisposed to epilepsy are likely more susceptible (see **Who should not use it**).
- **Long-term exposure:** the link between childhood leukaemia and average home fields above 0.3–0.4 µT is "not strong enough to be considered causal, but sufficiently strong to remain a concern". If it were causal, it would account for 100–2,400 cases a year worldwide, 0.2–4.9% of the total. WHO supports very low-cost precautions, but not lowering limits "to some arbitrary level in the name of precaution".

### IARC Monograph 80 (2002): Group 2B

- In June 2001 an IARC working group classified low-frequency magnetic fields as "possibly carcinogenic to humans (Group 2B)" ([IARC 2002](https://publications.iarc.who.int/download/mono80.pdf)). Static fields and low-frequency electric fields went into Group 3.
- **Basis:** limited evidence in humans for childhood leukaemia, inadequate evidence for all other cancers, and inadequate evidence in animals.
- **The human evidence** came from two pooled analyses. Children in homes averaging at least 0.4 µT had about twice the leukaemia risk of those below 0.1 µT (RR 2.0, 95% CI 1.3–3.1; 3,247 cases). The second gave RR 1.7 (1.2–2.3) above 0.3 µT, from 12 measurement-based studies ([IARC 2002](https://publications.iarc.who.int/download/mono80.pdf)).
- **Later pooled analyses are weaker:** OR 1.44 (0.88–2.36) at 0.3 µT or more ([Kheifets 2010](https://pubmed.ncbi.nlm.nih.gov/20877339/)), and OR 1.01 at 0.4 µT or more in 24,994 cases ([Amoon 2022](https://pubmed.ncbi.nlm.nih.gov/34481821/)). IARC had not re-evaluated the classification as of these sources.
- **What it means here.** Group 2B is about children living for years in homes with raised average fields over the whole body. It gives no evidence about brief, local head exposure. WHO's 2007 fact sheet listed coffee and welding fumes as other Group 2B agents at the time ([Fact Sheet 322](https://www.bpa.gov/-/media/Aep/lands/EMF_WHO_EMF-Fact-Sheet-2007a1.pdf)). As context only: one 30-minute session a week at 5 µT averages 0.015 µT over the week (project calculation). The two measures are not comparable, so this is not proof of safety.

### ICNIRP 2010 and later statements

- **Two kinds of limit** ([ICNIRP 2010](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgdl.pdf)):
  - *Basic restrictions* limit the electric field induced inside tissue. For the public's brain the limit is 10 mV/m at 10–25 Hz, rising above 25 Hz to 0.4 V/m at 1 kHz; for all head and body tissue it is 0.4 V/m up to 3 kHz. The workers' value (50 mV/m) is set at the phosphene threshold, and the public gets a further factor of 5.
  - *Reference levels* are easier-to-measure field values outside the body, derived for a uniform field over the whole body: 200 µT at 25–400 Hz for the public. For a very localised source a few centimetres from the body, ICNIRP says the induced field must be calculated instead, and reference levels may be exceeded locally if the basic restrictions are met. That is the case for this helmet (see **Physical exposure**).
- **Not covered:** implants (see **Implants**); "medical exposure", which includes research volunteers. The contact-current limit for the public is 0.5 mA.
- **Static fields** ([ICNIRP 2009](https://www.icnirp.org/cms/upload/publications/ICNIRPstatgdl.pdf)): 400 mT for the public. Protecting implanted devices can require much lower levels such as 0.5 mT.
- **2020 update:** "research with volunteers continues to indicate no substantiated neurobehavioral effects below the existing guideline values" ([ICNIRP 2020](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgaps2020.pdf)).
- **IEEE:** C95.1-2019 merged the older low-frequency standard C95.6-2002 ([IEEE 2019](https://w.mriquestions.com/uploads/3/4/5/7/34572113/ieee_standards_08910342.pdf)). The 2002 brain limit for the public is 5.89 mV/m up to 20 Hz, rising in proportion to frequency above that ([IEEE 2002](https://www.sandiegocounty.gov/content/dam/sdc/pds/ceqa/Soitec-Documents/Final-EIR-Files/references/rtcref/ch9.0/RTCrefappx/2014-12-19_IEEE2002.pdf)). Whether the 2019 text keeps that value is unverified.

### Other reviews

| Body (year) | Conclusion |
|---|---|
| NIEHS, USA (1999) | "The scientific evidence suggesting that ELF-EMF exposures pose any health risk is weak"; waking-EEG studies "generally negative". Yet these fields "cannot be recognized at this time as entirely safe" because of the leukaemia data ([NIEHS 1999](https://www.niehs.nih.gov/sites/default/files/health/assets/docs_p_z/report_powerline_electric_mg_predates_508.pdf)) |
| WHO hypersensitivity backgrounder (2005) | "there is no scientific basis to link EHS symptoms to EMF exposure" ([WHO 2005](https://www.who.int/teams/environment-climate-change-and-health/radiation-and-health/non-ionizing/hypersensitivity)) |
| SCENIHR, EU (2015) | Low-frequency studies of EEG, behaviour and cortical excitability are "not useful for drawing meaningful conclusions"; no convincing causal link to self-reported symptoms ([SCENIHR 2015](https://ec.europa.eu/health/scientific_committees/emerging/docs/scenihr_o_041.pdf)) |
| SSM, Sweden (2025, 2026) | "No new established causal relationships between EMF exposure and health risk have been identified"; the experimental human studies of 2024 were all therapeutic ([SSM 2026](https://www.stralsakerhetsmyndigheten.se/en/publications/reports/radiation-protection/2026/202603/); [SSM 2025](https://www.stralsakerhetsmyndigheten.se/en/publications/reports/radiation-protection/2025/202504/)) |

### What these positions do not cover

- Implants below the limits. ICNIRP says so itself.
- Persinger's pattern hypothesis. The guidelines deal with induced field strength and cancer epidemiology, not with the claim that a weak field acts through its timing.
- Repeated weekly sessions in susceptible people.
- Research volunteers, who fall outside ICNIRP's public category and IEEE's scope. For a self-experimenter the public limits are the sensible benchmark, which is how this page uses them (project interpretation).

## What is unknown

- **The real field of these coils.** The core material (ferrite or iron) is undocumented, and every number on this page comes from a model. Measure your coils ([CALIBRATION.md](CALIBRATION.md)). Tilted coils and real head shapes were not modelled.
- **Implant limits at this helmet's frequencies.** The ISO 14117 sensing limits below 3 kHz, the EN 50527-2-1 thresholds, and the ISO 14708 immunity levels for neurostimulators, cochlear implants and pumps were not obtained.
- **Manufacturer data.** EMI manuals for cochlear implants, DBS systems and shunt valves were not retrieved.
- **Sensing stimulators.** Whether DBS systems that record brain signals misread microvolt-level induced signals from a coil over the lead. There are no data.
- **Telecoil hum thresholds** for hearing aids and processors near small head coils.
- **Human seizures.** No case linked to microtesla patterned fields was found, but no systematic search was possible.
- **Adverse-event rates.** No registry exists. The full texts of the Persinger-lab trials, which might hold dropout or adverse-event counts, were not read. The 64-coil case is known only from a press release.
- **Replication of the adverse lab findings.** Aggression, suggestibility, false-statement acceptance and the prenatal rat results have never been tested independently.
- **Long-term effects** of repeated sessions. "Snapback" is a vendor claim that nobody has tested.
