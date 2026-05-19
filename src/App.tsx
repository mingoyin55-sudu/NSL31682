import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Settings, Activity, Zap, Target, SlidersHorizontal, Calculator, CheckCircle2, BookOpen } from 'lucide-react';
import clsx from 'clsx';

const DEFAULT_PARAMS = {
  vinTyp: 14,
  vinMin: 8,
  vinMax: 28,
  vout: 50,
  iout: 2,
  fsw: 200,

  L: 15,
  Cout: 84,
  Cin: 80,
  Ris: 10,
  Vslp: 250,

  Rcomp: 15,
  Ccomp: 33,
  Chf: 0.1,

  Rdson: 30,
  DCR: 15,
  Vf: 0.5,
  tsw: 30
};

export default function App() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [activeTab, setActiveTab] = useState('design'); // design, stability, efficiency, accuracy

  const handleParamChange = (key: string, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleOptimize = () => {
    setParams(prev => {
        const p = { ...prev };
        const Po_ph = (p.vout * p.iout) / 2;
        
        const dIL_PP = 2 * (1.4 - 1) * Po_ph / p.vinTyp; 
        const L_calc = (p.vinTyp * (p.vout - p.vinTyp)) / (dIL_PP * p.vout * (p.fsw * 1e3));
        p.L = Math.max(1, Math.round(L_calc * 1e6 * 10) / 10);

        const vRipple = 0.05; // 50mV
        const Cout_calc = (1 - p.vinMin/p.vout) * p.iout / (vRipple * (2 * p.fsw * 1e3));
        p.Cout = Math.max(10, Math.round(Cout_calc * 1e6));

        const Cin_calc = p.vinMin / (8 * (p.L * 1e-6 / 2) * Math.pow(2 * p.fsw * 1e3, 2) * 0.01) * (1 - p.vinMin/p.vout);
        p.Cin = Math.max(1, Math.round(Cin_calc * 1e6 * 10) / 10);

        const gm = 914e-6;
        const Hfb = 2.0 / p.vout;
        const Leq = p.L * 1e-6 / 2;
        const feq = p.fsw * 1e3 * 2;
        const Rq = (p.Ris / 1e3) / 2;
        const Vslpeq = p.Vslp / 1e3;
        const Fm = Rq / Vslpeq;
        const Fv = (p.vinTyp * p.vinTyp) / (2 * Leq * feq * Math.pow(p.vout, 2));
        const G0 = (Fm * Math.pow(p.vout, 2)) / (Rq * (p.vinTyp + Fm * Fv * Math.pow(p.vout, 2)));
        const wp1 = (p.vinTyp / (p.vout * p.Cout * 1e-6)) * (p.vinTyp / (Fm * Math.pow(p.vout, 2)) + Fv);
        const wz = Math.pow(p.vinTyp, 2) / ((p.vout * p.iout) * Leq);
        
        const K_C = 5;
        const Rcomp_calc = wz / (K_C * gm * G0 * Hfb * wp1);
        p.Rcomp = Math.max(0.1, Number((Rcomp_calc / 1000).toFixed(1)));
        
        const K_P = 2; 
        const Ccomp_calc = K_P / (wp1 * Rcomp_calc * 0.8);
        p.Ccomp = Math.max(1, Number((Ccomp_calc * 1e9).toFixed(1))); 
        
        p.Chf = Math.max(0.01, Number((p.Ccomp / 100).toFixed(2))); 

        return p;
    });
  };

  const calculatedValues = useMemo(() => {
    const Dtyp = 1 - (params.vinTyp / params.vout);
    const Dmax = 1 - (params.vinMin / params.vout);
    const Dmin = 1 - (params.vinMax / params.vout);
    
    const Po_total = params.vout * params.iout;
    const IL_avg = Po_total / params.vinTyp;
    const dIL_PP = (params.vinTyp * (params.vout - params.vinTyp)) / (params.L * 1e-6 * params.vout * params.fsw * 1e3);
    const IL_PK = (IL_avg / 2) + dIL_PP / 2;

    return { Dtyp, Dmax, Dmin, Po_total, dIL_PP, IL_PK };
  }, [params]);

  const bodeData = useMemo(() => {
    const data = [];
    const gm = 914e-6; 
    const Hfb = 2.0 / params.vout; 
    const Po = params.vout * params.iout;
    const Leq = params.L * 1e-6 / 2;
    const feq = params.fsw * 1e3 * 2;
    const Rq = (params.Ris / 1e3) / 2;
    const Vslpeq = params.Vslp / 1e3;

    const Fm = Rq / Vslpeq;
    const Fv = (params.vinTyp * params.vinTyp) / (2 * Leq * feq * Math.pow(params.vout, 2));

    const G0 = (Fm * Math.pow(params.vout, 2)) / (Rq * (params.vinTyp + Fm * Fv * Math.pow(params.vout, 2)));
    const Cout = params.Cout * 1e-6;
    const wp1 = (params.vinTyp / (params.vout * Cout)) * (params.vinTyp / (Fm * Math.pow(params.vout, 2)) + Fv);
    const wp2 = (Fm * params.vout) / Leq;
    const wz = Math.pow(params.vinTyp, 2) / (Po * Leq);

    const C1 = params.Ccomp * 1e-9;
    const C2 = params.Chf * 1e-9;
    const R1 = params.Rcomp * 1e3;
    const Ceq = (C1 * C2) / (C1 + C2);

    for (let logf = 2; logf <= 6; logf += 0.05) {
      const f = Math.pow(10, logf);
      const w = 2 * Math.PI * f;

      const Mp = G0 * Math.sqrt(1 + Math.pow(w / wz, 2)) / 
                 (Math.sqrt(1 + Math.pow(w / wp1, 2)) * Math.sqrt(1 + Math.pow(w / wp2, 2)));
      const phip = -Math.atan(w / wz) - Math.atan(w / wp1) - Math.atan(w / wp2);

      const Mc = (gm * Hfb) / (w * (C1 + C2)) * 
                 Math.sqrt(1 + Math.pow(w * R1 * C1, 2)) / 
                 Math.sqrt(1 + Math.pow(w * R1 * Ceq, 2));
      const phic = -Math.PI / 2 + Math.atan(w * R1 * C1) - Math.atan(w * R1 * Ceq);

      const Mt_dB = 20 * Math.log10(Mp * Mc);
      const Pht_deg = (phip + phic) * 180 / Math.PI;
      const PhaseMargin = 180 + Pht_deg;

      data.push({
        freq: f,
        gain: Mt_dB,
        phaseMargin: PhaseMargin
      });
    }
    return data;
  }, [params]);

  const efficiencyData = useMemo(() => {
    const data = [];
    const P_fixed = 0.5; 
    const { vinTyp, vout, fsw, Rdson, DCR, Vf, tsw, Ris } = params;
    const f_Hz = fsw * 1e3;
    const ts_s = tsw * 1e-9;
    
    for (let i = 0.1; i <= params.iout; i += 0.1) {
      const Pout = vout * i;
      const IL = Pout / vinTyp; 
      const D = 1 - (vinTyp / vout);
      const ILph = IL / 2;
      
      const IQ_rms = ILph * Math.sqrt(D);
      const IL_rms = ILph;

      const P_mos = 2 * (IQ_rms * IQ_rms * (Rdson/1000));
      const P_ind = 2 * (IL_rms * IL_rms * (DCR/1000));
      const P_diode = i * Vf; 
      const P_sw = 2 * (0.5 * vout * ILph * ts_s * f_Hz);
      const P_sense = 2 * (IQ_rms * IQ_rms * (Ris/1000));

      const P_loss = P_mos + P_ind + P_diode + P_sw + P_sense + P_fixed;
      const eff = (Pout / (Pout + P_loss)) * 100;
      
      data.push({
        load: Number(i.toFixed(1)),
        efficiency: eff,
        ploss: P_loss,
        breakdown: [
          { name: 'MOSFET', value: P_mos },
          { name: 'Inductor', value: P_ind },
          { name: 'Diode', value: P_diode },
          { name: 'Switching', value: P_sw },
          { name: 'Sense', value: P_sense },
          { name: 'Fixed', value: P_fixed }
        ]
      });
    }
    return data;
  }, [params]);

  const inductorCurrentData = useMemo(() => {
    const { vinTyp, vout, fsw, L, iout } = params;
    const D = 1 - (vinTyp / vout);
    const Tsw_us = 1000 / fsw; // Tsw in microseconds
    const po_ph = (vout * iout) / 2;
    const IL_avg = po_ph / vinTyp;
    const dIL_pp = (vinTyp * D) / (L * 1e-6 * fsw * 1e3);
    const IL_min = IL_avg - dIL_pp / 2;
    const IL_max = IL_avg + dIL_pp / 2;

    const data = [];
    data.push({ time: 0, current: IL_min });
    data.push({ time: D * Tsw_us, current: IL_max });
    data.push({ time: Tsw_us, current: IL_min });
    data.push({ time: Tsw_us + D * Tsw_us, current: IL_max });
    data.push({ time: 2 * Tsw_us, current: IL_min });

    return data;
  }, [params]);

  const currentBreakdown = efficiencyData[efficiencyData.length - 1]?.breakdown || [];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-gray-200 overflow-y-auto flex flex-col shadow-sm z-10 hidden md:flex">
        <div className="p-5 border-b border-gray-100 bg-white sticky top-0">
          <h1 className="text-xl font-bold flex items-center gap-2 text-blue-700">
            <Zap className="w-6 h-6" /> NSL31682
          </h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Two-Phase Boost CV Tool</p>
        </div>

        <div className="p-5 space-y-8 flex-1">
          <Section title="运行需求 (Requirements)">
            <Input label="VIN (Typ)" suffix="V" value={params.vinTyp} onChange={(v) => handleParamChange('vinTyp', v)} />
            <Input label="VIN (Min)" suffix="V" value={params.vinMin} onChange={(v) => handleParamChange('vinMin', v)} />
            <Input label="VIN (Max)" suffix="V" value={params.vinMax} onChange={(v) => handleParamChange('vinMax', v)} />
            <Input label="VOUT" suffix="V" value={params.vout} onChange={(v) => handleParamChange('vout', v)} />
            <Input label="IOUT (Max)" suffix="A" value={params.iout} onChange={(v) => handleParamChange('iout', v)} />
            <Input label="fSW / phase" suffix="kHz" value={params.fsw} onChange={(v) => handleParamChange('fsw', v)} />
          </Section>

          <Section title="功率器件 (Power Stage)">
            <Input label="Inductor (L)" suffix="µH" value={params.L} onChange={(v) => handleParamChange('L', v)} />
            <Input label="COUT (Total)" suffix="µF" value={params.Cout} onChange={(v) => handleParamChange('Cout', v)} />
            <Input label="CIN (Total)" suffix="µF" value={params.Cin} onChange={(v) => handleParamChange('Cin', v)} />
            <Input label="Sense (Ris)" suffix="m&Omega;" value={params.Ris} onChange={(v) => handleParamChange('Ris', v)} />
          </Section>

          <Section title="控制环路 (Control Loop)">
            <Input label="Slope (Vslp)" suffix="mV" value={params.Vslp} onChange={(v) => handleParamChange('Vslp', v)} />
            <Input label="Rcomp" suffix="k&Omega;" value={params.Rcomp} onChange={(v) => handleParamChange('Rcomp', v)} />
            <Input label="Ccomp" suffix="nF" value={params.Ccomp} onChange={(v) => handleParamChange('Ccomp', v)} />
            <Input label="Chf" suffix="nF" value={params.Chf} onChange={(v) => handleParamChange('Chf', v)} />
          </Section>

          <Section title="寄生参数 (Parasitics)">
            <Input label="MOSFET Rdson" suffix="m&Omega;" value={params.Rdson} onChange={(v) => handleParamChange('Rdson', v)} />
            <Input label="Inductor DCR" suffix="m&Omega;" value={params.DCR} onChange={(v) => handleParamChange('DCR', v)} />
            <Input label="Diode Vf" suffix="V" value={params.Vf} onChange={(v) => handleParamChange('Vf', v)} />
            <Input label="Switching tr+tf" suffix="ns" value={params.tsw} onChange={(v) => handleParamChange('tsw', v)} />
          </Section>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-slate-50 min-w-0">
        <header className="bg-white border-b border-gray-200 p-4 px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <nav className="flex flex-wrap gap-1 bg-gray-100/80 p-1 rounded-lg">
            <Tab id="design" icon={Calculator} label="参数设计" active={activeTab} set={setActiveTab} />
            <Tab id="stability" icon={Activity} label="稳定性分析" active={activeTab} set={setActiveTab} />
            <Tab id="efficiency" icon={Zap} label="效率评估" active={activeTab} set={setActiveTab} />
            <Tab id="registers" icon={SlidersHorizontal} label="寄存器配置" active={activeTab} set={setActiveTab} />
            <Tab id="instructions" icon={BookOpen} label="使用说明" active={activeTab} set={setActiveTab} />
          </nav>
          
          <button 
            onClick={handleOptimize}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition-colors shadow-sm whitespace-nowrap"
          >
            <Settings className="w-4 h-4" /> 自动最优化设计
          </button>
        </header>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto h-full space-y-6">
            
            {activeTab === 'design' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card title="计算核心参数" value={`${calculatedValues.Po_total.toFixed(1)} W`} subtitle="Total Output Power" />
                <Card title="占空比范围" value={`${(calculatedValues.Dmin*100).toFixed(1)}% - ${(calculatedValues.Dmax*100).toFixed(1)}%`} subtitle={`Typ: ${(calculatedValues.Dtyp*100).toFixed(1)}%`} />
                <Card title="电感峰值电流" value={`${calculatedValues.IL_PK.toFixed(2)} A`} subtitle={`Ripple: ${calculatedValues.dIL_PP.toFixed(2)} A`} />
                
                <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-200/60 mt-4">
                  <h3 className="font-semibold text-gray-800 mb-6 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" /> 器件选型建议
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <Recommendation label="电感 (L)" value={`&ge; ${params.L} µH`} sub={`ISAT &gt; ${(calculatedValues.IL_PK * 1.2).toFixed(2)} A`} />
                    <Recommendation label="输出电容 (Cout)" value={`&ge; ${params.Cout} µF`} sub={`VRATING &gt; ${(params.vout * 1.2).toFixed(1)} V`} />
                    <Recommendation label="输入电容 (Cin)" value={`&ge; ${params.Cin} µF`} sub={`VRATING &gt; ${(params.vinMax * 1.2).toFixed(1)} V`} />
                    <Recommendation label="MOSFET" value="100V, Logic Level" sub={`ID &gt; ${(calculatedValues.IL_PK * 1.5).toFixed(1)} A`} />
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-200/60 mt-4">
                  <h3 className="font-semibold text-gray-800 mb-6 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" /> 电感电流波形 (2 个开关周期)
                  </h3>
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={inductorCurrentData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis 
                          dataKey="time" 
                          type="number"
                          tickFormatter={(v) => v.toFixed(1)}
                          label={{ value: 'Time (µs)', position: 'bottom', offset: 0 }}
                          domain={['dataMin', 'dataMax']}
                        />
                        <YAxis 
                          label={{ value: 'Inductor Current (A)', angle: -90, position: 'insideLeft', fill: '#3B82F6' }} 
                          domain={['auto', 'auto']}
                        />
                        <Tooltip 
                          formatter={(val: number) => `${val.toFixed(2)} A`} 
                          labelFormatter={(lbl: number) => `Time: ${lbl.toFixed(2)} µs`}
                        />
                        <Line type="linear" dataKey="current" name="Current (IL)" stroke="#3B82F6" strokeWidth={3} dot={false} isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'stability' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200/60 h-[600px] flex flex-col">
                <h3 className="font-semibold text-gray-800 mb-6">系统环路伯德图 (Bode Plot)</h3>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={bodeData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="freq" 
                        scale="log" 
                        domain={[100, 1000000]} 
                        type="number"
                        tickFormatter={(v) => {
                          const num = parseFloat(Number(v).toPrecision(4));
                          return num >= 1000 ? `${num / 1000}k` : num.toString();
                        }}
                        label={{ value: 'Frequency (Hz)', position: 'bottom', offset: 0 }}
                      />
                      <YAxis yAxisId="left" domain={[-40, 80]} tickFormatter={(v) => parseFloat(Number(v).toPrecision(4)).toString()} label={{ value: 'Gain (dB)', angle: -90, position: 'insideLeft', fill: '#3B82F6' }} stroke="#3B82F6" />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 120]} tickFormatter={(v) => parseFloat(Number(v).toPrecision(4)).toString()} label={{ value: 'Phase Margin (°)', angle: 90, position: 'insideRight', fill: '#10B981' }} stroke="#10B981" />
                      <Tooltip formatter={(val: number) => parseFloat(Number(val).toPrecision(4))} labelFormatter={(lbl: number) => `Freq: ${parseFloat(Number(lbl).toPrecision(4))} Hz`} />
                      <Legend verticalAlign="top" height={36} />
                      <Line yAxisId="left" type="monotone" dataKey="gain" name="Loop Gain (dB)" stroke="#3B82F6" strokeWidth={3} dot={false} isAnimationActive={false} />
                      <Line yAxisId="right" type="monotone" dataKey="phaseMargin" name="Phase Margin (°)" stroke="#10B981" strokeWidth={3} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'efficiency' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200/60 flex flex-col">
                  <h3 className="font-semibold text-gray-800 mb-6">工作效率 vs 负载</h3>
                  <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={efficiencyData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="load" label={{ value: 'Load Current (A)', position: 'bottom' }} />
                        <YAxis yAxisId="left" domain={[80, 100]} label={{ value: 'Efficiency (%)', angle: -90, position: 'insideLeft', fill: '#8B5CF6' }} stroke="#8B5CF6" />
                        <Tooltip formatter={(val: number) => val.toFixed(2)} />
                        <Line yAxisId="left" type="monotone" dataKey="efficiency" name="Efficiency (%)" stroke="#8B5CF6" strokeWidth={3} dot={false} activeDot={{r: 6}} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200/60 flex flex-col">
                  <h3 className="font-semibold text-gray-800 mb-6">全载损耗分布 (Loss Breakdown)</h3>
                  <div className="flex-1 w-full min-h-0 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="80%">
                      <BarChart data={currentBreakdown} layout="vertical" margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" unit="W" />
                        <YAxis dataKey="name" type="category" width={80} />
                        <Tooltip formatter={(val: number) => `${val.toFixed(2)} W`} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {currentBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6'][index % 6]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'registers' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200/60 flex flex-col h-auto">
                <h3 className="font-semibold text-gray-800 mb-6 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-indigo-500" /> Two-Phase CV BOOST 寄存器配置流程 (SPI)
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-gray-800 font-medium">EN (0x00) = 0xB0</h4>
                      <p className="text-sm text-gray-500">复位故障引脚，关闭 CHxPDRV</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">2</div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-gray-800 font-medium">CFG1 (0x01) = 0x63 (内部 PWM) 或 0x23 (外部 PWM)</h4>
                      <p className="text-sm text-gray-500">将两个通道配置为 CV 模式并启用两相 (Two-Phase) 配置</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">3</div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-gray-800 font-medium">SWDIV (0x03)</h4>
                      <p className="text-sm text-gray-500">设置开关频率分频。默认 DIV = 2</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">4</div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-gray-800 font-medium">ISLOPE (0x04)</h4>
                      <p className="text-sm text-gray-500">设置斜坡补偿。默认 250mV (0x11)</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">5</div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-gray-800 font-medium">SOFTSTART (0x06) = 0xFF</h4>
                      <p className="text-sm text-gray-500">配置软启动时钟分频</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">6</div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-gray-800 font-medium">CH1IADJ (0x07)</h4>
                      <p className="text-sm text-gray-500">根据外部反馈分压电阻网络 (RFB1 和 RFB2) 设定所需的输出电压 VOUT</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">7</div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-gray-800 font-medium">PWM 配置</h4>
                      <p className="text-sm text-gray-500">
                        <b>内部 PWM：</b>CH1PWMH (0x0B) = 0x03, CH1PWML (0x0A) = 0xFF, CH2PWMH (0x0D) = 0x03, CH2PWML (0x0C) = 0xFF <br/>
                        <b>外部 PWM：</b>将 PWM1 和 PWM2 引脚拉高
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">8</div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-gray-800 font-medium">ILIM (0x0E)</h4>
                      <p className="text-sm text-gray-500">修改为期望的 iLIM_THR 和事件计数器值</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">9</div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-gray-800 font-medium">OV (0x16)</h4>
                      <p className="text-sm text-gray-500">修改为期望的过压阈值，默认为设定 VOUT 的 105% (5%)</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">10</div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-gray-800 font-medium">FLT1 (0x11) & FLT2 (0x12)</h4>
                      <p className="text-sm text-gray-500">连续读取两次 Fault-1 和 Fault-2 寄存器以清除之前的可能故障</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">11</div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-gray-800 font-medium">EN (0x00) = 0xB3</h4>
                      <p className="text-sm text-gray-500">使能两相 CV BOOST 模式</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">12</div>
                    </div>
                    <div className="pb-4">
                      <h4 className="text-gray-800 font-medium">FLT1 (0x11) & FLT2 (0x12)</h4>
                      <p className="text-sm text-gray-500">再次读取两次寄存器确保配置成功且无故障发生</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'instructions' && (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200/60 flex flex-col h-auto">
                <h3 className="font-semibold text-gray-800 mb-6 flex items-center gap-2 text-xl">
                  <BookOpen className="w-6 h-6 text-blue-600" /> NSL31682 Two-Phase CV BOOST 工具使用说明
                </h3>
                
                <div className="space-y-8 text-gray-700 leading-relaxed">
                  <section>
                    <h4 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3">🛠 基本操作流程</h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>在左侧边栏的 <b>“运行需求”</b> 栏目中，输入系统目标参数（如输入电压范围、输出电压、最大电流、开关频率）。</li>
                      <li>您可以手动在侧边栏微调 <b>功率器件</b>、<b>控制环路</b> 和 <b>寄生参数</b>；由于参数关联复杂，强烈建议您点击右上角的 <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs">自动最优化设计</span> 按钮。系统将一键为您计算出最优的电感(L)、输入输出电容(Cin, Cout) 以及最关键的环路补偿参数(Rcomp, Ccomp, Chf)。</li>
                      <li>在顶部导航栏切换不同页面，全面评估系统的可靠性和效能。只要左侧参数发生改变，右侧所有波形和计算结果都会 <b>实时动态刷新</b>。</li>
                    </ol>
                  </section>

                  <section>
                    <h4 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3">📊 核心功能模块解析</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      
                      <div className="bg-gray-50 border border-gray-100 p-4 rounded-lg">
                        <h5 className="font-bold text-gray-800 flex items-center gap-2 mb-2"><Calculator className="w-4 h-4 text-blue-500" /> 参数设计</h5>
                        <p className="text-sm">展示计算出的重要占空比、系统总功率、以及核心的元器件选型推荐（给出容值流抗耐压的底线）。下方提供 <b>双周期电感电流波形仿真</b>，帮助确认纹波设计是否合理，识别是否处于连续导通模式(CCM)。</p>
                      </div>

                      <div className="bg-gray-50 border border-gray-100 p-4 rounded-lg">
                        <h5 className="font-bold text-gray-800 flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-green-500" /> 稳定性分析</h5>
                        <p className="text-sm">利用双极点、左半平面零点（系统级）加比例积分补偿（PI）传递函数，动态生成系统的 <b>开环伯德图(Bode Plot)</b>。横轴标注频率，双纵轴分别指示系统增益以及相位裕度，用于检测瞬态响应能力与抗振荡鲁棒性。</p>
                      </div>

                      <div className="bg-gray-50 border border-gray-100 p-4 rounded-lg">
                        <h5 className="font-bold text-gray-800 flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-purple-500" /> 效率评估</h5>
                        <p className="text-sm">分析整个升压系统中的传导、开关及直直流损耗。不仅生成了在不同负载权重下的 <b>效率曲线图</b>，还提供在满载工况下的 <b>功率损耗精确分布柱状图</b>（MOSFET、电感 DCR、寄生、检测电阻 Ris等），用以指导散热设计。</p>
                      </div>

                      <div className="bg-gray-50 border border-gray-100 p-4 rounded-lg">
                        <h5 className="font-bold text-gray-800 flex items-center gap-2 mb-2"><SlidersHorizontal className="w-4 h-4 text-indigo-500" /> 寄存器配置</h5>
                        <p className="text-sm">提供详尽的基于 SPI 通信协议配置 NSL31682 芯片进入 <b>两相恒压升压 (Two-Phase CV BOOST)</b> 模式的 12 个系统初始化执行步骤与对应寄存器写值。</p>
                      </div>
                    </div>
                  </section>
                  
                  <section>
                    <h4 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3">💡 进阶使用提示</h4>
                    <ul className="list-disc pl-5 space-y-2 text-sm">
                      <li><b>斜坡补偿 (ISLOPE/Vslp)</b>：控制占空比超过 50% 时的次谐波振荡；系统默认 250mV，您可以手动调试它与伯德图相位裕度的关系。</li>
                      <li><b>电流检测电阻 (Ris)</b>：不合理的值可能导致效率锐减或是提前触发系统过流限位。</li>
                    </ul>
                  </section>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------- UI Subcomponents ----------------

function Input({ label, value, onChange, suffix }: { label: string, value: number, onChange: (v: number) => void, suffix: string }) {
  return (
    <div className="mb-3">
      <label className="text-xs font-medium text-gray-600 mb-1.5 block">{label}</label>
      <div className="relative flex items-center">
        <input 
          type="number" 
          className="w-full bg-gray-50 border border-gray-200 rounded-md py-1.5 pl-3 pr-12 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          step="any"
        />
        <span className="absolute right-3 text-xs text-gray-400 pointer-events-none select-none">{suffix}</span>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="mb-6 border-b border-gray-100 pb-4 last:border-0">
      <h2 className="text-sm font-bold text-gray-800 mb-4">{title}</h2>
      {children}
    </div>
  )
}

function Tab({ icon: Icon, label, active, set, id }: any) {
  const isActive = active === id;
  return (
    <button 
      onClick={() => set(id)}
      className={clsx(
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
        isActive ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-800 hover:bg-white/50"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

function Card({ title, value, subtitle }: { title: string, value: string, subtitle: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200/60 transition-all hover:shadow-md">
      <h4 className="text-sm font-medium text-gray-500 mb-3">{title}</h4>
      <div className="text-3xl font-bold text-gray-800 mb-1">{value}</div>
      <div className="text-xs font-medium text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded-md">{subtitle}</div>
    </div>
  )
}

function Recommendation({ label, value, sub }: { label: string, value: string, sub: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider text-nowrap">{label}</span>
      <span className="text-xl font-bold text-gray-800" dangerouslySetInnerHTML={{__html: value}} />
      <span className="text-xs text-gray-400 mt-1" dangerouslySetInnerHTML={{__html: sub}} />
    </div>
  )
}
