import {FunctionalComponent, h} from "preact";
import {getMetrics} from "../../utils/data";
import style from './style.css';

const DistributionViewer: FunctionalComponent = () => {
    // Fetch the metrics from local storage and fail out if there are none stored or local storage is disabled
    const metrics = getMetrics();
    if (metrics === null) return (<div>Failed to load progress</div>);

    // Figure out the max so that we can align all of them to the same level
    const max = Math.max(...Object.values(metrics.distribution));
    // The keys are mapped to a string in a pretty horrific chaining but end up as strings ordered from smallest to highest
    const keys = Object.keys(metrics.distribution)
        .map((e) => Number(e))
        .sort((a, b) => a - b)
        .map((e) => String(e));

    return (
        <div>
            {/*Each entry in the distribution produces a bar that contains the label and then a bar proportionally to*/}
            {/*its value based on the length of the longest one*/}
            {keys.map((e) => (
                <div className={style.row} key={`dist_${e}`}>
                    <div className={style.label}>{e}</div>
                    <div className={style.container}>
                        <div className={style.inner} style={{width: `${(metrics.distribution[e] / max) * 100}%`}}>
                            {metrics.distribution[e]}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default DistributionViewer;