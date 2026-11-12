# Prints this machine's load as JSON: {"cpu", "mem", "battery", "charging", "load"} (percentages).
# Linux: /proc/stat (two samples 250 ms apart), /proc/meminfo, /sys/class/power_supply.
import glob, json, os, time

def cpu_times():
    with open("/proc/stat") as f:
        v = [int(x) for x in f.readline().split()[1:]]
    idle = v[3] + (v[4] if len(v) > 4 else 0)
    return sum(v), idle

t1, i1 = cpu_times(); time.sleep(0.25); t2, i2 = cpu_times()
cpu = 100.0 * (1 - (i2 - i1) / max(1, t2 - t1))

mem = {}
with open("/proc/meminfo") as f:
    for line in f:
        k, v = line.split(":", 1)
        mem[k] = int(v.split()[0])
used = 100.0 * (1 - mem.get("MemAvailable", 0) / max(1, mem.get("MemTotal", 1)))

battery, charging = None, False
for b in glob.glob("/sys/class/power_supply/BAT*"):
    try:
        battery = int(open(f"{b}/capacity").read().strip())
        charging = open(f"{b}/status").read().strip() in ("Charging", "Full")
        break
    except Exception:
        pass

print(json.dumps({"cpu": round(min(100, max(0, cpu)), 1), "mem": round(used, 1),
                  "battery": battery, "charging": charging, "load": round(os.getloadavg()[0], 2)}))
