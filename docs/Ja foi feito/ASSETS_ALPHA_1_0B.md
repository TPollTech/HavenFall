# Assets Alpha 1.0B — States, Beds, Death & Harvest Feedback

Este manifesto lista os sprites finais recomendados para substituir os placeholders visuais desenhados por canvas em `src/game/21_alpha_state_system.js` e `src/game/23_alpha_base_doors.js`.

O sistema já funciona sem estes PNGs, mas estes nomes devem ser usados quando os assets forem produzidos.

## Colonos — estados principais

Direções: `down`, `up`, `left`, `right`.

### Coleta

```txt
colonist_gather_chop_down_0.png
colonist_gather_chop_down_1.png
colonist_gather_chop_down_2.png
colonist_gather_chop_down_3.png
colonist_gather_chop_up_0.png
colonist_gather_chop_up_1.png
colonist_gather_chop_up_2.png
colonist_gather_chop_up_3.png
colonist_gather_chop_left_0.png
colonist_gather_chop_left_1.png
colonist_gather_chop_left_2.png
colonist_gather_chop_left_3.png
colonist_gather_chop_right_0.png
colonist_gather_chop_right_1.png
colonist_gather_chop_right_2.png
colonist_gather_chop_right_3.png

colonist_gather_mine_down_0.png
colonist_gather_mine_down_1.png
colonist_gather_mine_down_2.png
colonist_gather_mine_down_3.png
colonist_gather_mine_up_0.png
colonist_gather_mine_up_1.png
colonist_gather_mine_up_2.png
colonist_gather_mine_up_3.png
colonist_gather_mine_left_0.png
colonist_gather_mine_left_1.png
colonist_gather_mine_left_2.png
colonist_gather_mine_left_3.png
colonist_gather_mine_right_0.png
colonist_gather_mine_right_1.png
colonist_gather_mine_right_2.png
colonist_gather_mine_right_3.png
```

### Sono, recuperação e incapacitado

```txt
colonist_sleep_down_0.png
colonist_sleep_down_1.png
colonist_downed_down_0.png
colonist_downed_left_0.png
colonist_dead_down_0.png
colonist_dead_left_0.png
colonist_carried_down_0.png
colonist_carried_left_0.png
colonist_hurt_down_0.png
colonist_hurt_left_0.png
```

### Combate e trabalho

```txt
colonist_attack_melee_down_0.png
colonist_attack_melee_down_1.png
colonist_attack_melee_down_2.png
colonist_attack_melee_down_3.png
colonist_attack_melee_up_0.png
colonist_attack_melee_up_1.png
colonist_attack_melee_up_2.png
colonist_attack_melee_up_3.png
colonist_attack_melee_left_0.png
colonist_attack_melee_left_1.png
colonist_attack_melee_left_2.png
colonist_attack_melee_left_3.png
colonist_attack_melee_right_0.png
colonist_attack_melee_right_1.png
colonist_attack_melee_right_2.png
colonist_attack_melee_right_3.png

colonist_build_down_0.png
colonist_build_down_1.png
colonist_build_down_2.png
colonist_build_down_3.png
```

## Ferramentas — overlays futuros

```txt
tool_axe_swing_down_0.png
tool_axe_swing_down_1.png
tool_axe_swing_down_2.png
tool_axe_swing_down_3.png
tool_pickaxe_swing_down_0.png
tool_pickaxe_swing_down_1.png
tool_pickaxe_swing_down_2.png
tool_pickaxe_swing_down_3.png
tool_hammer_swing_down_0.png
tool_hammer_swing_down_1.png
tool_hammer_swing_down_2.png
tool_hammer_swing_down_3.png
weapon_spear_thrust_down_0.png
weapon_spear_thrust_down_1.png
weapon_spear_thrust_down_2.png
weapon_spear_thrust_down_3.png
```

## FX

```txt
fx_wood_chip_01.png
fx_wood_chip_02.png
fx_stone_chip_01.png
fx_stone_chip_02.png
fx_dust_puff_01.png
fx_hit_impact_01.png
fx_hit_impact_02.png
fx_sleep_zzz_01.png
fx_heal_plus_01.png
fx_door_open_01.png
fx_door_close_01.png
fx_door_hit_01.png
```

## Objetos do mundo

```txt
bed_occupied.png
bed_recovery.png
rock_crack_01.png
rock_crack_02.png
tree_hit_01.png
tree_hit_02.png
corpse_colonist_01.png
corpse_wolf_01.png
```

## Portas e abrigo

```txt
door_wood_closed_horizontal.png
door_wood_open_horizontal_0.png
door_wood_open_horizontal_1.png
door_wood_open_horizontal_2.png
door_wood_closed_vertical.png
door_wood_open_vertical_0.png
door_wood_open_vertical_1.png
door_wood_open_vertical_2.png
door_wood_damaged_01.png
door_wood_broken_01.png
```

## Lobo

```txt
wolf_attack_0.png
wolf_attack_1.png
wolf_attack_2.png
wolf_hurt_0.png
wolf_dead_0.png
```

## Observação de implementação

A Alpha 1.0B não depende destes arquivos para rodar. Enquanto eles não existem, `21_alpha_state_system.js` e `23_alpha_base_doors.js` usam:

- rotação do sprite base para sono/incapacitado/morto;
- tags de estado acima do colono;
- partículas desenhadas por canvas;
- barras de progresso no recurso alvo;
- overlay simples na cama ocupada;
- porta `door_wood` rotacionada/aberta por canvas.

Quando os PNGs estiverem prontos, o próximo patch deve substituir os desenhos por canvas por sprites reais, mantendo os mesmos nomes de estado.
