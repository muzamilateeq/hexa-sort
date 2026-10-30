import cv2
import numpy as np

board = cv2.imread('assets/game-page-ui/board-full.png', cv2.IMREAD_UNCHANGED)
h, w = board.shape[:2]
b, g, r, a = cv2.split(board)
cavity_mask = (r < 135) & (g < 90) & (b < 80) & (a > 200)
opened = cv2.morphologyEx((cavity_mask*255).astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(opened)

cavities = [centroids[i] for i in range(1, num_labels) if 200 < stats[i, cv2.CC_STAT_AREA] < 1500]
cavities.sort(key=lambda c: c[0])
cols = [
    (sorted(cavities[0:3], key=lambda c: c[1]), -2, [-1, 0, 1]),
    (sorted(cavities[3:7], key=lambda c: c[1]), -1, [-1.5, -0.5, 0.5, 1.5]),
    (sorted(cavities[7:12], key=lambda c: c[1]), 0, [-2, -1, 0, 1, 2]),
    (sorted(cavities[12:16], key=lambda c: c[1]), 1, [-1.5, -0.5, 0.5, 1.5]),
    (sorted(cavities[16:19], key=lambda c: c[1]), 2, [-1, 0, 1])
]

print('const BOARD_SLOT_DEFS = [')
for items, col_val, r_vals in cols:
    print(f'  // Col {col_val}')
    for pt, r_val in zip(items, r_vals):
        u = round((pt[0] - w/2) / w, 5)
        v = round((pt[1] - h/2) / h, 5)
        print(f"  {{ id: '{col_val},{r_val}', col: {col_val}, r: {r_val}, u: {u}, v: {v} }},")
print('];')
