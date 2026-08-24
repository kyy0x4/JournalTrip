import { P2HRecord } from '../../types';
import { TenkoRecord } from '../../services/tenkoService';
import Logo from '../../image/Logo.png';

interface GatepassDocumentProps {
  driverName: string;
  nopol: string;
  area?: string;
  shift?: string;
  nik?: string;
  date: string;
  docNumber: string;
  printDateTime: string;
  p2hRecord?: P2HRecord | null;
  tenkoRecord?: TenkoRecord | null;
}

export default function GatepassDocument({
  driverName, nopol, area, shift, nik, date, docNumber, printDateTime, p2hRecord, tenkoRecord,
}: GatepassDocumentProps) {
  return (
    <div id="gatepass-print-document" className="w-[800px] h-[800px] flex flex-col bg-white text-slate-900 p-10 font-sans">
      {/* Header Surat */}
      <div className="flex justify-between items-start border-b-4 border-double border-slate-900 pb-4 mb-6">
        <div className="w-[200px] shrink-0">
          <img src={Logo} alt="K Line" className="h-10 object-contain" />
        </div>
        <div className="text-center flex-1 pt-1.5">
          <h1 className="text-3xl font-black uppercase tracking-widest text-slate-900">Gate Pass</h1>
        </div>
        <div className="w-[200px] shrink-0 text-[8px] font-semibold text-slate-500 leading-normal text-right">
          <p>Jl. Sultan Agung Km.28</p>
          <p>Bekasi Barat 17133</p>
          <p>Telp. (021) 88861101-03</p>
        </div>
      </div>

      {/* Nomor Surat & Tanggal */}
      <div className="flex justify-between items-center text-xs mb-6">
        <div>
          <p className="font-bold text-slate-500 uppercase text-[9px]">Nomor Dokumen:</p>
          <p className="font-black text-slate-900 uppercase">{docNumber}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-slate-500 uppercase text-[9px]">Tanggal &amp; Jam:</p>
          <p className="font-black text-slate-900">{printDateTime}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Data Pengemudi */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b pb-1">Data Pengemudi</h4>
          <table className="w-full text-xs">
            <tbody>
              <tr>
                <td className="py-1 text-slate-500 w-24">Nama:</td>
                <td className="py-1 font-black text-slate-900 uppercase">{driverName}</td>
              </tr>
              <tr>
                <td className="py-1 text-slate-500">NIK:</td>
                <td className="py-1 font-bold text-slate-900">{nik || '--'}</td>
              </tr>
              <tr>
                <td className="py-1 text-slate-500">Area:</td>
                <td className="py-1 font-bold text-slate-900 uppercase">{area || '--'}</td>
              </tr>
              <tr>
                <td className="py-1 text-slate-500">Shift:</td>
                <td className="py-1 font-bold text-slate-900 uppercase">{shift || '--'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Data Kendaraan */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b pb-1">Data Kendaraan</h4>
          <table className="w-full text-xs">
            <tbody>
              <tr>
                <td className="py-1 text-slate-500 w-24">No. Polisi:</td>
                <td className="py-1 font-black text-slate-900">{nopol || '--'}</td>
              </tr>
              <tr>
                <td className="py-1 text-slate-500">Tanggal Jalan:</td>
                <td className="py-1 font-bold text-slate-900">{date}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Verifikasi Kelayakan */}
      <div className="space-y-4 mb-8">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b pb-1">Verifikasi Kelayakan</h4>

        <div className="grid grid-cols-2 gap-4">
          {/* Tenko */}
          <div className={`p-4 border rounded-xl space-y-2 ${tenkoRecord ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
            <div className={`flex items-center gap-2 ${tenkoRecord ? 'text-emerald-700' : 'text-slate-500'}`}>
              <span className={`w-2 h-2 rounded-full ${tenkoRecord ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span className="text-[10px] font-black uppercase tracking-wider">Tenko Health Check</span>
            </div>
            <p className={`text-xl font-black ${tenkoRecord ? 'text-emerald-700' : 'text-slate-400'}`}>
              {tenkoRecord ? 'LULUS (OK)' : 'BELUM DICEK'}
            </p>
            {tenkoRecord && (
              <div className="text-[10px] space-y-1 text-slate-700">
                <p>Tensi Darah: <span className="font-bold">{tenkoRecord.tensi} mmHg</span></p>
                <p>Suhu Tubuh: <span className="font-bold">{tenkoRecord.suhu_tubuh} °C</span></p>
                <p>Alkohol: <span className="font-bold">{Number(tenkoRecord.alkohol) > 0 ? 'POSITIF' : 'NEGATIF (0.00%)'}</span></p>
                <p>Fatigue: <span className="font-bold">{tenkoRecord.fatigue || 'NORMAL'}</span></p>
              </div>
            )}
          </div>

          {/* P2H */}
          <div className={`p-4 border rounded-xl space-y-2 ${p2hRecord?.status === 'OK' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
            <div className={`flex items-center gap-2 ${p2hRecord?.status === 'OK' ? 'text-emerald-700' : 'text-slate-500'}`}>
              <span className={`w-2 h-2 rounded-full ${p2hRecord?.status === 'OK' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span className="text-[10px] font-black uppercase tracking-wider">P2H Unit Check</span>
            </div>
            <p className={`text-xl font-black ${p2hRecord ? (p2hRecord.status === 'OK' ? 'text-emerald-700' : 'text-rose-600') : 'text-slate-400'}`}>
              {p2hRecord ? (p2hRecord.status === 'OK' ? 'LULUS (OK)' : 'TIDAK LULUS (NG)') : 'BELUM DICEK'}
            </p>
            {p2hRecord && (
              <div className="text-[10px] space-y-1 text-slate-700">
                <p>Dicek Oleh: <span className="font-bold uppercase">{p2hRecord.checked_by || '-'}</span></p>
                <p>Catatan: <span className="font-bold">{p2hRecord.catatan || '-'}</span></p>
              </div>
            )}
          </div>
        </div>

        {/* Keputusan */}
        <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Keputusan Dispatcher</p>
            <p className="text-lg font-black uppercase tracking-wide">Boleh Beroperasi / Depart</p>
          </div>
          <div className="text-right text-[9px] font-semibold text-slate-300 leading-relaxed">
            <p>Dokumen ini sah tanpa tanda tangan basah</p>
            <p>berdasarkan verifikasi sistem P2H &amp; Tenko</p>
          </div>
        </div>
      </div>

      {/* Footer Signatures */}
      <div className="mt-auto flex justify-between items-end pt-4 border-t border-slate-200">
        <div className="text-center w-44">
          <p className="mb-14 uppercase font-bold text-[10px] text-slate-600">Dispatcher / HSSE</p>
          <div className="border-b border-slate-800 w-full mb-1"></div>
          <p className="uppercase text-[10px] font-semibold">Security Gate</p>
        </div>

        <div className="text-center w-44">
          <p className="mb-14 uppercase font-bold text-[10px] text-slate-600">Mitra Driver</p>
          <div className="border-b border-slate-800 w-full mb-1"></div>
          <p className="uppercase text-[10px] font-semibold">{driverName}</p>
        </div>
      </div>
    </div>
  );
}
