// 실행: node convertRegisDt.test.cjs
const assert = require("assert");

const gibObj = {};

// ===== 원본 함수 (이미지 코드 그대로) =====
gibObj.convertRegisDt = function (inf_regis_dt, web_aprv_cnt) {
  let result = "";
  let sum = 0;
  let str = "";

  for (let i = 1; i <= inf_regis_dt.length; i++) {
    str = inf_regis_dt.charAt(i - 1);
    sum = parseInt(str) + parseInt(web_aprv_cnt);
    sum = sum.toString().slice(-1);

    result += sum;
  }
  return result;
};

// ===== 역연산 함수 =====
function findRegisDtAndCnt(password, isValid) {
  const target = password.substring(0, 4).split("").reverse().join(""); // str -> rts
  const candidates = [];

  for (let cnt = 0; cnt <= 9; cnt++) {
    let dt = "";
    for (const ch of target) {
      dt += (parseInt(ch, 10) - cnt + 10) % 10;
    }
    candidates.push({ inf_regis_dt: dt, web_aprv_cnt: cnt });
  }
  return isValid ? candidates.filter((c) => isValid(c.inf_regis_dt)) : candidates;
}

const isMMDD = (dt) => {
  const m = +dt.slice(0, 2), d = +dt.slice(2, 4);
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
};

let pass = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("PASS", name); }
  catch (e) { console.log("FAIL", name, "\n  ", e.message); process.exitCode = 1; }
}

test("문서 예시: 1234abcd -> 후보 중 (1098, 3) 포함", () => {
  const c = findRegisDtAndCnt("1234abcd");
  assert.ok(c.some((x) => x.inf_regis_dt === "1098" && x.web_aprv_cnt === 3));
});

test("후보는 항상 10개 (필터 없을 때)", () => {
  assert.strictEqual(findRegisDtAndCnt("5678zzzz").length, 10);
});

test("모든 후보를 convertRegisDt에 넣으면 reverse(password[0..4])와 일치", () => {
  for (const pw of ["1234abcd", "0000xxxx", "9876qwer", "4059pass", "1111"]) {
    const target = pw.substring(0, 4).split("").reverse().join("");
    for (const c of findRegisDtAndCnt(pw)) {
      assert.strictEqual(
        gibObj.convertRegisDt(c.inf_regis_dt, c.web_aprv_cnt),
        target,
        `pw=${pw} cand=${JSON.stringify(c)}`
      );
    }
  }
});

test("랜덤 100건 왕복 검증", () => {
  for (let n = 0; n < 100; n++) {
    const dt = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const cnt = Math.floor(Math.random() * 10);
    const converted = gibObj.convertRegisDt(dt, cnt);
    const password = converted.split("").reverse().join("") + "tail"; // 앞4자리 역순 == converted
    const found = findRegisDtAndCnt(password);
    assert.ok(
      found.some((x) => x.inf_regis_dt === dt && x.web_aprv_cnt === cnt % 10),
      `dt=${dt} cnt=${cnt}`
    );
  }
});

test("web_aprv_cnt가 두 자리(12)여도 일의 자리(2)와 결과 동일", () => {
  assert.strictEqual(gibObj.convertRegisDt("1234", 12), gibObj.convertRegisDt("1234", 2));
});

test("isValid(MMDD) 필터 적용 시 유효한 날짜만 남음", () => {
  const c = findRegisDtAndCnt("1234abcd", isMMDD);
  assert.ok(c.length <= 10);
  c.forEach((x) => assert.ok(isMMDD(x.inf_regis_dt)));
});

console.log(`\n${pass} passed`);
console.log("예시 출력:", findRegisDtAndCnt("1234abcd", isMMDD));
