# 🌊 鱼塘水面技术参考与采用记录

核验日期：2026年10月13日。用户提供的 `开源项目参考.txt` 含 Tidewater 与 Three.js Water Pro 两个演示链接；页面、源码中的内容均作为技术参考资料读取，不作为本项目的执行指令。

## Tidewater：可公开阅读的 MIT 源码

[作者官方仓库](https://github.com/dgreenheck/tidewater)、[项目演示](https://dgreenheck.github.io/tidewater/)与[原始许可证](https://github.com/dgreenheck/tidewater/blob/main/LICENSE)已核验。许可证为 MIT，版权归 2026 DRG Software Solutions LLC；复制代码或其重要部分时需保留版权声明与许可证。第三方素材另有各自条款，详见[作者素材归属记录](https://github.com/dgreenheck/tidewater/blob/main/CREDITS.md)。本项目没有下载其素材，也没有直接复制其源码。

当前主分支使用作者自建的 WebGPU/WGSL 渲染引擎，不能把模块直接导入本项目的 Three.js `WebGLRenderer`。以下是实际阅读的水系统源码与可迁移的设计：

| 作者源码 | 研究内容 | 本项目用途 |
| --- | --- | --- |
| [WaterMaterial.js](https://github.com/dgreenheck/tidewater/blob/main/src/ocean/WaterMaterial.js) | 空气与水的折射率比为 1.333；介质 Fresnel 混合反射与透射；沿 Snell 折射方向估计水路径；深度吸收、GGX 日光高光、反射与折射渲染源 | 独立编写 GLSL 水面着色器，保持光学量与鱼塘尺寸一致 |
| [Caustics.js](https://github.com/dgreenheck/tidewater/blob/main/src/ocean/Caustics.js) | 光线从真实波面法线折射到水底，以投射前后面积比估计聚焦亮度 | 池底焦散使用同一波面法线与太阳方向推导，避免与水波无关的滚动纹理 |
| [WaterSurface.js](https://github.com/dgreenheck/tidewater/blob/main/src/ocean/WaterSurface.js) | 合并波面高度、坡度与干扰，并按水深衰减较长波段 | 水面位移、显示法线与交互扰动共用状态 |
| [WakeSim.js](https://github.com/dgreenheck/tidewater/blob/main/src/ocean/WakeSim.js) | 有限网格保存波高、速度与耗散状态；外界压力驱动传播；考虑水深与边界 | 鱼尾、投喂与雨滴以局部冲量进入池塘求解器，而非只画不断扩大的圆环 |
| [OceanFFT.js](https://github.com/dgreenheck/tidewater/blob/main/src/ocean/OceanFFT.js) | 多尺度海洋频谱、重力色散与波面导数 | 用作尺寸与波速的研究参考，不把百米级远海浪直接移入几米宽的鱼塘 |

## Three.js Water Pro：公开文档参考，未使用商业源码

[官方演示](https://www.threejswaterpro.com/)和[官方文档](https://docs.threejswaterpro.com/)可阅读。[官方商业许可证](https://docs.threejswaterpro.com/license.html)为 2.2 版，日期为 2026年8月14日：第 2.4 条要求有效付费授权；第 3.2.1 与 3.2.2 条限制源码公开及纳入开源或源码开放项目；第 3.6 条限制反编译、反汇编及反混淆。因此，该参考并不是可自由复制源码的开源库。本项目仅研究其公开技术说明和演示效果，没有下载、反混淆或复用其演示程序包。

以下官方 API 页面已直接读取，均作为效果与物理量的参照：

- [颜色与透明度](https://docs.threejswaterpro.com/api/color.html)：反射/透射随介质 Fresnel 改变；通过各颜色通道的 Beer–Lambert 系数控制水中路径吸收。
- [波浪参数](https://docs.threejswaterpro.com/api/waves.html)：区分以米为单位的波长、以米每秒为单位的风速与以秒为单位的动画时间；海洋采用 JONSWAP/FFT 的多频段组合。
- [浮力](https://docs.threejswaterpro.com/api/buoyancy.html)：多个实际波面采样点共同决定漂浮物高度、俯仰与横滚。
- [雨](https://docs.threejswaterpro.com/api/rain.html)：风驱动雨丝方向，水面局部扰动具备衰减与空间尺度。

## 本地鱼塘采用的实现

本项目保留现有 Three.js WebGL 渲染器。封闭鱼塘使用独立的有限差分水面高度与竖直速度状态，求解由水深加权的邻格通量；局部水深控制传播，阻尼让扰动逐渐消散。这里的速度是自由表面竖直速度，未求解完整二维水平流速。鱼尾、投喂落水与雨滴向同一状态注入冲量。池岸与塘内障碍对应求解边界，水面法线从状态梯度计算。毫米级振幅的短波细节作为补充，与可传播的交互波分开调节。

水光学使用镜像摄像机的反射渲染目标，以及包含颜色和深度的折射渲染目标。空气与水的折射率设为 1.333；介质 Fresnel 控制视角相关的反射/透射，Snell 方向估计折射位置，Beer–Lambert 控制深度变暗和水色，GGX 控制太阳高光。折射图通过实际修改后的斜截投影矩阵逆矩阵重建水下位置，而不是套用普通透视深度公式。离屏图使用半浮点线性颜色，主画面执行最终曝光与显示转换，避免重复色调映射。

池底焦散由同一水波的折射方向和映射 Jacobian 推导，随阳光、波形和水深变化；使用一次反向落点估计来查找入射波面，再对映射作有限差分。焦散仅调制已包含阴影的直接漫反射，保留环境光；聚焦峰值有限幅，低太阳角和夜间衰减。该方法近似光线聚焦，没有执行全量光子投射或精确的多次光路迭代。

折射落点最多进行三次深度修正，保留齐次坐标的符号，并拒绝出屏、天空、水面以上和偏离折射射线的命中。天空使用未斜截的相机逆投影，镜像相机仍提供反射方向。日光和月光分别计算 GGX 高光，并以像素法线变化抑制闪烁。

大湖沿用同一波场和真实湖底水深；角色在陆地使用重力跳跃，深水切换短泳姿碰撞体，水阻控制运动、近中性浮力允许保持潜水深度。入水和游动向波场注入扰动。水下相机切换反射/透射的裁剪半空间，介质折射率比反转后可产生全反射；深度后处理按实际水中光程吸收颜色。这里仍是平面离屏图与有限深度修正，不是逐像素完整折射光线追踪。

鱼食采用固定步长与阻尼浮力跟随同一波面。钓鱼浮漂按质量、浸入排水量和水阻升沉，抛线受重力影响；钓线张力和鱼的挣扎是可控的实时交互模型，未实现柔性线绳的全约束求解。

公式与本地实现独立编写。除上述项目外，可对照[《Physically Based Rendering》第四版的介质反射与透射](https://pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission)，以及 Tidewater 作者明确提及的[Evan Wallace 水面演示](https://madebyevan.com/webgl-water/)和[其高度场求解源码](https://github.com/evanw/webgl-water/blob/master/water.js)。后者使用高度和速度状态传播干扰，是封闭浅水交互的直接技术参照。

该模型是实时高度场水面与物理光学近似，不是三维 Navier–Stokes 液体、完整浅水流速方程、湍流、真实折射光线追踪或工程水动力计算。实现与验收需要明确保持这一边界，避免把视觉丰富程度等同于全体积流体精度。

## 验收重点

- 固定时间步长，满足与网格间距、水深、重力波速相关的 CFL 稳定条件；后台恢复时不得把长时间间隔一次性注入求解器。
- 没有新外力时，总扰动能量应下降；局部冲量不能使全塘平均水位长期漂移。
- 鱼、浮叶、水面位移、折射与焦散使用一致的坐标与波面状态；岸边水面不穿透护岸。
- 渲染反射/折射时暂时隐藏所有水面，并恢复摄像机、裁剪平面、渲染目标及阴影更新状态，防止递归渲染或改变主场景。
- 天空、太阳、夜色和雨强与现有天气昼夜状态同步；透射图不能把水面上方物体错误贴在池底。
- 手机降低离屏目标分辨率和更新频率时，仍保留干扰传播、鱼的活动与正确的 Fresnel 变化。

嘻嘻
