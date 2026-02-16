#!/usr/bin/env python3
"""Generate an isosceles triangle diagram matching the AQA exam style."""

from PIL import Image, ImageDraw, ImageFont
import math

# Canvas size
W, H = 1024, 1024
img = Image.new('RGB', (W, H), 'white')
draw = ImageDraw.Draw(img)

# Triangle vertices - A at top, B bottom-left, C bottom-right
# Isosceles with AB = AC, angle A = 40°
# Make it look like the existing diagrams

# Position A at top centre
Ax, Ay = 512, 120

# The half-angle at A is 20°, so sides go down at 20° from vertical
half_angle = 20  # degrees
side_length = 700  # pixels

# B is bottom-left, C is bottom-right
Bx = Ax - side_length * math.sin(math.radians(half_angle))
By = Ay + side_length * math.cos(math.radians(half_angle))
Cx = Ax + side_length * math.sin(math.radians(half_angle))
Cy = Ay + side_length * math.cos(math.radians(half_angle))

# Draw triangle
line_width = 3
draw.line([(Ax, Ay), (Bx, By)], fill='black', width=line_width)
draw.line([(Ax, Ay), (Cx, Cy)], fill='black', width=line_width)
draw.line([(Bx, By), (Cx, Cy)], fill='black', width=line_width)

# Draw angle arc at A
arc_radius = 70
# The arc goes from the direction of AB to AC
# Direction to B from A
angle_to_B = math.degrees(math.atan2(By - Ay, Bx - Ax))
angle_to_C = math.degrees(math.atan2(Cy - Ay, Cx - Ax))

# PIL arc uses 0° = 3 o'clock, going clockwise
# We need to draw arc from direction of AB to AC
arc_bbox = [Ax - arc_radius, Ay - arc_radius, Ax + arc_radius, Ay + arc_radius]
draw.arc(arc_bbox, start=angle_to_C, end=angle_to_B, fill='black', width=2)

# Draw tick marks on AB and AC (equal sides)
def draw_tick_marks(draw, x1, y1, x2, y2, num_ticks=2, tick_len=18):
    """Draw tick marks at midpoint of a line segment."""
    mx = (x1 + x2) / 2
    my = (y1 + y2) / 2

    # Direction perpendicular to line
    dx = x2 - x1
    dy = y2 - y1
    length = math.sqrt(dx*dx + dy*dy)
    # Perpendicular unit vector
    px = -dy / length
    py = dx / length

    spacing = 12
    for i in range(num_ticks):
        offset = (i - (num_ticks - 1) / 2) * spacing
        # Along the line direction
        lx = dx / length
        ly = dy / length
        cx = mx + offset * lx
        cy = my + offset * ly

        draw.line([
            (cx - tick_len/2 * px, cy - tick_len/2 * py),
            (cx + tick_len/2 * px, cy + tick_len/2 * py)
        ], fill='black', width=3)

draw_tick_marks(draw, Ax, Ay, Bx, By, num_ticks=2)
draw_tick_marks(draw, Ax, Ay, Cx, Cy, num_ticks=2)

# Try to load a nice font, fall back to default
try:
    font_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 48)
    font_angle = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 42)
except:
    font_label = ImageFont.load_default()
    font_angle = ImageFont.load_default()

# Draw vertex labels
# A - above the apex
draw.text((Ax, Ay - 70), "A", fill='black', font=font_label, anchor='mm')

# B - below-left
draw.text((Bx - 20, By + 30), "B", fill='black', font=font_label, anchor='mm')

# C - below-right
draw.text((Cx + 20, Cy + 30), "C", fill='black', font=font_label, anchor='mm')

# Draw angle label "40°" inside the angle arc
angle_label_radius = arc_radius + 50
angle_mid = (angle_to_B + angle_to_C) / 2
label_x = Ax + angle_label_radius * math.cos(math.radians(angle_mid))
label_y = Ay + angle_label_radius * math.sin(math.radians(angle_mid))
draw.text((label_x, label_y), "40°", fill='black', font=font_angle, anchor='mm')

# Save
output_path = '/sessions/lucid-optimistic-noether/mnt/The-Maths-Habit/public/images/Isoceles 40.png'
img.save(output_path, 'PNG')
print(f"Saved to {output_path}")
print(f"Image size: {img.size}")
