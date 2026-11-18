# TAG MCS Companion Module

This module integrates with the TAG Video Systems MCS API (v5), allowing you to switch layouts and audio channels on outputs. It communicates directly with the TAG MCS (not MCM), which is the system of record in mixed environments.

---

## 🔧 Configuration

- **MCS IP Address**  
  The IP address of the TAG MCS system.

- **Port**  
  Defaults to `443`.

- **Username / Password**  
  Credentials for API access.

- **Enable Polling**  
  Whether the module should poll the MCS for updates (default: `true`).

- **Polling Rate (milliseconds)**  
  How often to refresh data (default: `5000` seconds).

- **Enable Layout Variables**  
  Creates the tile variables below for every layout, whether or not it is on an output. With many layouts this is a lot of variables, and the module may read each layout's tiles from the MCS on every poll.

- **Verbose Mode**  
  Enable logging of internal actions and API responses for debugging.

---

## ⚙️ Actions

- **Select Output**
  Select an Output to be used in other actions.

- **Select Layout**
  Select a Layout to be used in other actions.

- **Select Video Channel**
  Select a Video Channel to be used in other actions.

- **Select Audio Channel**
  Select a Audio Channel to be used in other actions.

- **Select Tile Number**
  Select a Tile Number to be used in other actions.

- **Select Device**
  Select a Device to be used in other actions.

- **Modify Layout**
  Modify a layout by changing the Video Channel assigned to a Tile Number.

- **Set Output State**
  Turn the output either on or off.

- **Apply Layout to Output**  
  Assign a layout to an output. These can either be chosen from a list or using the pre-selected Output or Layout.

- **Change Audio Channel for Output**  
  Assign a selected audio channel to an output, using `audio_index` (defaults to `1`).

---

## 💡 Feedbacks

- **Layout is Active on Output**  
  Active when a selected layout is currently assigned to an output. These can either be chosen from a list or using the pre-selected Output or Layout.

- **Output is Active on Device**
  Active when the chosen output is assigned to the chosen device.

---

## 📊 Variables

Variables are generated per output, layout, and channel.

### ➤ Outputs

- `output_<uuid>_label` — Display Label UUID of the Output
- `output_<uuid>_layout_label` — Label of the Layout currently assigned
- `output_<uuid>_audio_channel_label` — Label of the audio channel
- `output_<uuid>_mux_audio_pid` — Output audio PID
- `output_<uuid>_device` - Output Device UUID
- `output_<uuid>_device_label` - Output Device Label

### ➤ Layouts

- `layout_<uuid>_label` — Display Label UUID of the Layout
- `layout_<uuid>_tile_count` — Number of Tiles in the Layout (blank until the MCS has listed the layout's tiles)

#### ➤ Layouts - Tiles

Only with **Enable Layout Variables** on. `${i}` counts from `0` in the order the MCS lists the tiles. Use `_number` for the Tile Number that **Modify Layout** takes.

- `layout_<uuid>_tile_${i}_type` - Tile Type (Clock, Channel, Text Box, etc.)
- `layout_<uuid>_tile_${i}_number` - Tile Number, as **Modify Layout** takes it
- `layout_<uuid>_tile_${i}_channel` - Tile Channel UUID (if type Channel)
- `layout_<uuid>_tile_${i}_channel_label` - Tile Channel Label (if type Channel)
- `layout_<uuid>_tile_${i}_text` - Tile Text (if type Text Box)

### ➤ System Info

- `output_count` — Total number of Outputs
- `layout_count` — Total number of Layouts
- `channel_count` - Total number of Channels
