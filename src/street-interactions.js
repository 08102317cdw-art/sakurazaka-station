export function createStreetInteractions(kit) {
  const { THREE, cylinder, box, sign } = kit;
  const group = new THREE.Group();
  group.name = '街角可以触碰的日常';
  const drink = new THREE.Group();
  drink.name = '自动贩卖机取出口的汽水';
  drink.userData.dynamic = true;
  drink.userData.walkCollision = false;
  drink.visible = false;
  drink.position.set(0.66, 0.57, 13.25);
  group.add(drink);
  cylinder(drink, 0, 0, 0, 0.054, 0.19, '#b6c9bd', 10);
  cylinder(drink, 0, 0.099, 0, 0.053, 0.012, '#dbe0ce', 10);
  box(drink, -0.055, 0, 0, 0.006, 0.068, 0.081, '#f1ead5', { outline: false });
  const name = sign(drink, 'ラムネ', -0.06, 0, 0, 0.075, 0.037, { bg: '#f1ead5', fg: '#748b72', rotationY: -Math.PI / 2 });
  name.userData.dynamic = true;
  let dispensing = false;
  let timer = 0;
  let collected = 0;
  group.userData.interactions = [
    {
      id: 'street-soda', position: new THREE.Vector3(0.57, 1.1, 13.25), radius: 2.9,
      label: () => drink.visible ? '取出冰凉的汽水' : '买一瓶汽水 · ¥120',
      action({ toast }) {
        if (drink.visible) {
          drink.visible = false;
          dispensing = false;
          collected++;
          toast('取出一瓶汽水，瓶身还带着凉意');
        } else {
          drink.visible = true;
          dispensing = true;
          timer = 0;
          drink.position.y = 0.57;
          toast('咔嗒——汽水落进了取出口，再按一次取出');
        }
      },
    },
    {
      id: 'street-map', position: new THREE.Vector3(9, 1.6, -3.45), radius: 2.2,
      label: '阅读小镇散步地图',
      action({ inspect }) {
        inspect('桜坂，午后散步路线', '沿站前街向南：喫茶こもれび、刚出炉的面包。\n穿过店铺之间的小巷：储物间、后院与晒太阳的猫。\n车站东侧步道：桜坂观光塔。乘玻璃升降舱上楼，在树梢之上看电车经过。\n住宅与远处街区均可通过门口进入，二层请走室内楼梯。');
      },
    },
  ];
  return { group, update(dt) {
    if (!dispensing) return;
    timer += dt;
    drink.position.y = 0.57 - Math.min(timer / 0.32, 1) * 0.125;
    if (timer >= 0.32) dispensing = false;
  }, get snapshot() { return { available: drink.visible, collected }; } };
}
