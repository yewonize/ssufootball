import fs from 'fs';

const matchCSV = fs.readFileSync('match_records.csv', 'utf8');
const playerCSV = fs.readFileSync('player_records.csv', 'utf8');
const profileCSV = fs.readFileSync('2026 숭실대학교 축구단 명단.csv', 'utf8');

const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = [];
        let inQuote = false;
        let val = '';
        for(let char of line) {
            if(char === '"') { inQuote = !inQuote; continue; }
            if(char === ',' && !inQuote) { values.push(val.trim()); val = ''; }
            else val += char;
        }
        values.push(val.trim());
        return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] || '' }), {});
    });
};

// 1. 경기 로그 데이터 먼저 파싱 (경기별 MOM 및 득점자 추출용)
const rawLogs = parseCSV(playerCSV);

// 2. 경기 데이터 생성 (MOM, 득점자 포함)
const matches = parseCSV(matchCSV).map(m => {
    const docId = `${m['날짜']}_${m['상대팀']}`.replace(/\s/g, '_');
    let status = 'Upcoming', home = 0, away = 0, pso = null;
    
    if(m['스코어'] && m['스코어'].includes(':')) {
        status = 'Finished';
        const parts = m['스코어'].split('(')[0].split(':');
        home = parseInt(parts[0]); away = parseInt(parts[1]);
        if(m['스코어'].includes('(')) pso = m['스코어'].split('(')[1].replace(')', '');
    }

    // 해당 경기의 로그들 필터링
    const matchLogs = rawLogs.filter(l => l['날짜'] === m['날짜'] && l['상대팀'] === m['상대팀']);
    
    // MOM 찾기
    const momRecord = matchLogs.find(l => l['MOM'] === 'O' || l['MOM'] === l['선수명']);
    
    // 득점자 명단 추출 (득점이 1 이상인 선수들)
    const scorers = matchLogs
        .filter(l => parseInt(l['득점']) > 0)
        .map(l => ({ name: l['선수명'], count: parseInt(l['득점']) }));

    return {
        docId,
        date: m['날짜'],
        opponent: m['상대팀'],
        type: `${m['대회명']} ${m['라운드']}`.trim(),
        isHome: true,
        status,
        homeScore: home,
        awayScore: away,
        pso,
        year: parseInt(m['연도']) || 2025,
        mom: momRecord ? momRecord['선수명'] : null,
        scorers: scorers
    };
});

// 3. match_logs 구조 개선 (연도, 날짜, 상대교 포함)
const logs = rawLogs.map(l => {
    const matchYear = parseInt(l['연도']) || (l['날짜'] ? parseInt(l['날짜'].split('-')[0]) : 2025);
    return {
        matchId: `${l['날짜']}_${l['상대팀']}`.replace(/\s/g, '_'),
        year: matchYear,
        date: l['날짜'],
        opponent: l['상대팀'],
        name: l['선수명'],
        starter: l['선발/교체'] === '선발',
        minutes: parseInt(l['출전시간']) || 0,
        goals: parseInt(l['득점']) || 0,
        assists: parseInt(l['도움']) || 0,
        mom: l['MOM'] === 'O' || l['MOM'] === l['선수명'],
        note: l['비고'] || ''
    };
}).filter(l => l.matchId && l.name);

// 4. 선수 명단 데이터 생성
const players = parseCSV(profileCSV)
    .filter(p => p['배번'] && !isNaN(parseInt(p['배번'])))
    .map(p => ({
        name: p['이름'],
        number: parseInt(p['배번']),
        position: p['포지션'],
        grade: parseFloat(p['학년(학번)']) || 0,
        status: 'current',
        profile: { 
            birthday: p['생년월일'], 
            height: parseFloat(p['신장(CM)']) || 0, 
            weight: parseFloat(p['체중(KG)']) || 0, 
            highSchool: p['출신교'] 
        }
    }));

const jsContent = `export const initialData = {
  matches: ${JSON.stringify(matches, null, 2)},
  players: ${JSON.stringify(players, null, 2)},
  logs: ${JSON.stringify(logs, null, 2)}
};`;

fs.writeFileSync('src/initialData.js', jsContent);
console.log('src/initialData.js 생성 완료! (MOM, scorers, match_logs 세분화 포함)');