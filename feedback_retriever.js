
import { Builder, By } from 'selenium-webdriver';

import { readFileSync, writeFileSync } from 'fs';

// const URL_ELC_HOME = 'https://cas2.uga.edu/cas/login?service=https://ssomanager-prod.uga.edu:443/ssomanager/c/SSB';
const URL_ELC_HOME = 'https://sso.uga.edu/cas/login?service=https%3a%2f%2fuga.view.usg.edu%2fd2l%2fcustom%2fcas';

const URL_GRADES_VIEW = 'https://uga.view.usg.edu/d2l/lms/grades/admin/enter/user_list_view.d2l?ou=';

const OUTPUT_FILE = 'output.json';
const PASSCODES_FILENAME = './config/passcodes.json';

const COURSE_ID = '1955242';

const DEVELOPMENT_MODE = false;

class FeedbackRetriever {

    constructor(username, password, passcode, courseId) {
        this.driver = new Builder()
            .forBrowser('chrome')
            .build();

        this.username = username;
        this.password = password;
        this.passcode = passcode;
        this.courseId = courseId;
    }

    waitWhileThePageLoadsUp(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    async filter(arr, callback) {
        const fail = Symbol()
        return (await Promise.all(arr.map(async item => (await callback(item)) ? item : fail))).filter(i=>i!==fail);
    }

    async click(element) {
        await this.driver.executeScript("arguments[0].click();", element);
    }

    async loginToELC() {

        console.log("Logging in to your ELC account");

        await this.driver.get(URL_ELC_HOME);
        let element = await this.driver.findElement({ name: 'username' });
        await element.sendKeys(this.username);
        let element_1 = await this.driver.findElement({ name: 'password' });
        await element_1.sendKeys(this.password);
        let submitBtn = await this.driver.findElement({ name: "submit" });
        await this.click(submitBtn);

        // duo frame begins
        await this.driver.switchTo().frame('duo_iframe');
        let passcodeElem = await this.driver.findElement({ id : "passcode"});
        await this.click(passcodeElem);
        let element_3 = await this.driver.findElement({ name: 'passcode' });
        await element_3.sendKeys(this.passcode);
        passcodeElem = await this.driver.findElement({ id : "passcode"});
        await this.click(passcodeElem);
        await this.driver.switchTo().defaultContent();
    }

    async loadCourseHome() {

        await this.driver.get(URL_COURSE_HOME + this.courseId);

        // TODO : locate course using CRN
        // let course_divs = await this.driver.findElements({ className: 'course-text' });

        // const promises = course_divs.map(async course_div => {
        //     const innerText = await course_div.getText();
            
        //     if (innerText.indexOf(course_id) !== -1) {
        //         return true;
        //     }

        //     return false;
        // });

        // let results_div = await Promise.all(promises);

        // if (!results_div || results_div.length < 1) {
        //     console.error("No course found with the given course id");
        // }

        // await this.driver.executeScript("arguments[0].parentNode.parentNode.click();", results_div[0]);

    }

    async loadGrades() {

        this.driver.get(URL_GRADES_VIEW + this.courseId);

        // document.getElementsByTagName("d2l-navigation")[0].getElementsByTagName("d2l-navigation-main-footer")[0].childNodes[0].childNodes[0]

        // let navElements = await this.driver.findElements({ tagName: "d2l-navigation" });

        // let navFooters = await navElements[0].findElements({ tagName: "d2l-navigation-main-footer" });

        // let navItems = await navFooters[0].findElements(By.xpath(".//div//div//div"));

        // let gradeNavItems = navItems.map(async navItem => {
        //     let navItemLinks = await navItem.findElements({ tagName: "a" });

        //     if (navItemLinks[0]) {
        //         let linkText = await navItemLinks[0].getText();
        //         return linkText === "Grades";
        //     }

        //     return false;
        // });

        // let results = await Promise.all(gradeNavItems);

        // await navItems[results.indexOf(true)].click();
    }

    async loadFeedbackView() {

        let userTbl = await this.driver.findElement({ id : "z_bk" });

        let firstUser = await userTbl.findElement(By.xpath(".//tbody//tr[3]//a[3]"));

        await firstUser.click();
    }

    async collectUserFeedbacks(result) {

        // get username
        let headings = await this.driver.findElements({ className : "vui-heading-1"});

        let username = await headings[0].getText();

        // expand all comment sections
        let commentsTogglers = await this.driver.findElements({ className: "di_l d2l-link d2l-link-inline" });

        commentsTogglers = await this.filter(commentsTogglers,async tg => {
            let text = await tg.getText();
            return text === 'Show Comments';
        });

        for (let i=0; i < commentsTogglers.length; i++) {
            await this.driver.executeScript("arguments[0].click()", commentsTogglers[i]);
        }

        // retrieve the feedbacks
        let commentsDivs = await this.driver.findElements({ className: "d2l-htmlblock d2l-htmlblock-deferred d2l-htmlblock-untrusted" });

        // start from 3rd div and skip one
        let feedbacks = [];
        for (let i=2; i < commentsDivs.length; i += 2) {
            let feedback = await commentsDivs[i].getText();
            feedbacks.push(feedback);
        }

        result[username] = feedbacks;

        // console.log (result);
    }

    async nextUser() {

        let nextBtnCls = await this.driver.findElements({ className: "d2l-iterator-button d2l-iterator-button-next d2l-iterator-button-notext"});

        let isDisabled = await nextBtnCls[0].getAttribute("aria-disabled");

        if (!isDisabled) {
            await nextBtnCls[0].click();
        }

        return !isDisabled;
    }

    async start() {

        try {

            if (DEVELOPMENT_MODE) {
                await this.driver.get("file:///C:/Users/16piy/Documents/TestScripts/uga_elc_feedback_retriever/dw_pages/first_user_view.html");
                await this.waitWhileThePageLoadsUp(1000);
            } else {
                await this.loginToELC();
                await this.waitWhileThePageLoadsUp(5000);
                await this.loadGrades();
                await this.waitWhileThePageLoadsUp(5000);
                await this.loadFeedbackView();
                await this.waitWhileThePageLoadsUp(5000);
            }
            
            let hasNext = true;
            
            let result = {}
            
            while (hasNext) {
                await this.collectUserFeedbacks(result);
                hasNext = await this.nextUser();
            }

            // console.log( JSON.stringify (result));

            writeFileSync(OUTPUT_FILE, JSON.stringify(result), 'utf8');
            
        } catch (error) {
            console.log (error);
        } finally {
            await this.driver.close();
        }

    }

}


function getConfig() {
    return JSON.parse(readFileSync('./config/config.json'), 'utf8');
}

function getPassCodes() {
    return JSON.parse(readFileSync(PASSCODES_FILENAME, 'utf8'));
}

function setPassCodes(passCodes) {
    writeFileSync(PASSCODES_FILENAME, JSON.stringify(passCodes), 'utf8');
}


async function startJob() {

    let passCodes = getPassCodes();

    if(passCodes && passCodes.length > 0) {
        const config = getConfig();

        let automater = new FeedbackRetriever(config.MY_USERNAME, config.MY_PASSWORD, passCodes[0], COURSE_ID);
        
        await automater.start();

        // remove the used passcode
        setPassCodes(passCodes.slice(1));

    } else {
        console.log("OUT OF PASSCODES. CANNOT PROCEED. FILL THE passcodes.json WITH VALID PASSCODES TO PROCEED");
    }

}

try {
    startJob();
} catch (error) {
    console.log("MAIN ERROR " + JSON.stringify(error));
}